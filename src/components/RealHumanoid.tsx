import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF, TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import { CCDIKSolver } from 'three/examples/jsm/animation/CCDIKSolver.js'
import { create } from 'zustand'

export const usePoseStore = create<any>((set: any) => ({
  history: [],
  future: [],
  pushState: (snap: any) => set((s: any) => ({ history: [...s.history, snap], future: [] })),
  undo: (scene: THREE.Object3D) => set((s: any) => {
    if (s.history.length === 0) return s;
    const last = s.history[s.history.length - 1]; const current = saveSnapshot(scene);
    applySnapshot(scene, last); return { history: s.history.slice(0, -1), future: [current, ...s.future] }
  }),
  redo: (scene: THREE.Object3D) => set((s: any) => {
    if (s.future.length === 0) return s;
    const next = s.future[0]; const current = saveSnapshot(scene);
    applySnapshot(scene, next); return { history: [...s.history, current], future: s.future.slice(1) }
  })
}))

function saveSnapshot(scene: THREE.Object3D) {
  const snap: Record<string, any> = {}
  scene.traverse((o: any) => {
    if ((o as any).isBone) {
      snap[o.name] = { q: [o.quaternion.x, o.quaternion.y, o.quaternion.z, o.quaternion.w] };
      if (o.name === 'mixamorigHips') snap[o.name].p = [o.position.x, o.position.y, o.position.z]
    }
  })
  return snap
}

function applySnapshot(scene: THREE.Object3D, snap: any) {
  scene.traverse((o: any) => {
    if ((o as any).isBone && snap[o.name]) {
      const q = snap[o.name].q;
      if (Array.isArray(q)) o.quaternion.set(q[0], q[1], q[2], q[3]);
      else if (q._x !== undefined) o.quaternion.set(q._x, q._y, q._z, q._w);
      else o.quaternion.copy(q);

      if (o.name === 'mixamorigHips' && snap[o.name].p) {
        const p = snap[o.name].p;
        if (Array.isArray(p)) o.position.set(p[0], p[1], p[2]);
        else if (p.x !== undefined) o.position.set(p.x, p.y, p.z);
        else o.position.copy(p);
      }
      o.updateMatrixWorld(true)
    }
  })
}

function useDirectDrag(camera: THREE.Camera, gl: THREE.WebGLRenderer, onDrag: (pos: THREE.Vector3) => void, onStart: () => void, onEnd: () => void) {
  const dragPlane = useRef(new THREE.Plane())
  const raycaster = useRef(new THREE.Raycaster())
  const hitPoint = useRef(new THREE.Vector3())

  return {
    onPointerDown: (e: any) => {
      e.stopPropagation(); gl.domElement.setPointerCapture(e.pointerId); onStart()
      const camDir = new THREE.Vector3(); camera.getWorldDirection(camDir)
      dragPlane.current.setFromNormalAndCoplanarPoint(camDir.negate(), e.object.getWorldPosition(new THREE.Vector3()))
      
      const dom = gl.domElement
      const onMove = (ev: PointerEvent) => {
        const rect = dom.getBoundingClientRect()
        const mx = ((ev.clientX - rect.left) / rect.width) * 2 - 1
        const my = -((ev.clientY - rect.top) / rect.height) * 2 + 1
        raycaster.current.setFromCamera(new THREE.Vector2(mx, my), camera)
        if (raycaster.current.ray.intersectPlane(dragPlane.current, hitPoint.current)) {
          onDrag(hitPoint.current.clone())
        }
      }
      
      const onUp = (ev: PointerEvent) => {
        if (dom.hasPointerCapture(ev.pointerId)) dom.releasePointerCapture(ev.pointerId)
        dom.removeEventListener('pointermove', onMove); dom.removeEventListener('pointerup', onUp)
        onEnd()
      }
      dom.addEventListener('pointermove', onMove); dom.addEventListener('pointerup', onUp)
    }
  }
}

function DragNode({ bone, orbitRef, scene, ikTargetsRef, draggingRef, onSelected }: any) {
  const { camera, gl } = useThree()
  const [hovered, setHovered] = useState(false)
  const meshRef = useRef<THREE.Mesh>(null)

  const isDraggable = true; // 所有控制端均可拖拽定位

  useFrame(() => { if (meshRef.current && bone) bone.getWorldPosition(meshRef.current.position) })
  
  const dragBind = useDirectDrag(camera, gl, 
    (pos) => {
       if (bone.name === 'mixamorigHips') {
          const hips = scene.getObjectByName('mixamorigHips')
          if (hips && hips.parent) { hips.parent.worldToLocal(pos); hips.position.copy(pos) }
       } else {
          // 所有非骨盆节点：更新其专属的 IK 幽灵目标点位置，完全不污染本身的 Rotate！
          if (ikTargetsRef.current[bone.name]) ikTargetsRef.current[bone.name].position.copy(pos)
       }
    },
    () => { if (orbitRef.current) orbitRef.current.enabled = false; draggingRef.current = bone.name; },
    () => { if (orbitRef.current) orbitRef.current.enabled = true; draggingRef.current = null; usePoseStore.getState().pushState(saveSnapshot(scene)) }
  )

  return (
    <mesh ref={meshRef} 
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = isDraggable ? 'grab' : 'pointer' }}
      onPointerOut={(e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'auto' }}
      onPointerDown={(e) => { 
        e.stopPropagation(); 
        onSelected(bone.name);
        if (isDraggable && dragBind.onPointerDown) dragBind.onPointerDown(e);
      }}
      scale={hovered ? (isDraggable ? 1.4 : 1.2) : 1.0}
    >
      <sphereGeometry args={[0.045, 24, 24]} />
      <meshStandardMaterial color="#44bbff" emissive="#115588" transparent opacity={0.8} depthTest={false} />
    </mesh>
  )
}

export function RealHumanoid({ orbitRef }: any) {
  const { scene } = useGLTF('/models/Xbot.glb')
  const solverRef = useRef<CCDIKSolver | null>(null)
  const ikTargetsRef = useRef<Record<string, THREE.Bone>>({})
  const draggingRef = useRef<string | null>(null)
  const [selectedBoneName, setSelectedBoneName] = useState<string|null>(null)

  // 专门服务于 TransformControls 的无缝抗抖动边界检测函数
  const lastValidQ = useRef<THREE.Quaternion>(new THREE.Quaternion());
  const enforceGizmoLimitsWithoutJitter = useMemo(() => (b: THREE.Object3D) => {
      const euler = b.rotation.clone();
      let isOut = false;
      const checkE = (minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number) => {
          if (euler.x < minX || euler.x > maxX || euler.y < minY || euler.y > maxY || euler.z < minZ || euler.z > maxZ) isOut = true;
      };
      const halfPI = Math.PI / 2;
      if (b.name.includes('Head') || b.name.includes('Neck')) checkE(-halfPI, halfPI, -halfPI, halfPI, -Math.PI/4, Math.PI/4);
      else if (b.name.includes('Spine')) checkE(-halfPI, halfPI, -halfPI, halfPI, -halfPI, halfPI); 
      else if (b.name.includes('Foot')) checkE(-halfPI, halfPI, -halfPI, halfPI, -halfPI, halfPI);
      else if (b.name.includes('UpLeg')) checkE(-Math.PI, Math.PI, -Math.PI, Math.PI, -halfPI, halfPI);
      else if (b.name.includes('Leg')) checkE(0.01, 2.8, -Math.PI, Math.PI, -Math.PI, Math.PI); 
      
      if (isOut) {
          // 如果旋转仪把数值拨出了边界，强制将其本地属性退回到最后一帧合法数值！
          // 由于 TransformControls 是基于相对切面运算，退回数值会导致 UI 光环在越界处呈现完美的物理阻滞停靠，并且移动回来时能立即脱离，0抖动！
          b.quaternion.copy(lastValidQ.current);
          b.updateMatrixWorld(true);
      } else {
          lastValidQ.current.copy(b.quaternion);
      }
  }, []);

  useEffect(() => {
    const handleClear = () => setSelectedBoneName(null);
    window.addEventListener('clear-selection', handleClear);
    return () => window.removeEventListener('clear-selection', handleClear);
  }, []);

  const CONTROL_BONES = ['mixamorigHips', 'mixamorigSpine1', 'mixamorigSpine2', 'mixamorigHead', 'mixamorigLeftHand', 'mixamorigRightHand', 'mixamorigLeftFoot', 'mixamorigRightFoot', 'mixamorigLeftForeArm', 'mixamorigRightForeArm', 'mixamorigLeftLeg', 'mixamorigRightLeg']

  useEffect(() => {
    let sm: any = null;
    scene.traverse(c => { 
        if ((c as any).isSkinnedMesh) {
            if (!sm || c.name === 'Alpha_Surface') sm = c;
        } 
    });
    if (!sm) return;
    // 超级鲁棒的获取骨骼 Index 函数：不存在则强行注入！绝对杜绝越界返回 -1 导致物理引擎崩溃白屏！
    const safeGetIdx = (name: string) => {
        let idx = (sm as any).skeleton.bones.findIndex((b: any) => b && b.name === name)
        if (idx === -1) {
            const b = scene.getObjectByName(name)
            if (b) {
                (sm as any).skeleton.bones.push(b);
                (sm as any).skeleton.boneInverses.push(new THREE.Matrix4());
                idx = (sm as any).skeleton.bones.length - 1;
            }
        }
        return idx;
    }

    // 为所有可控制关节量身定制末端牵引链：拖动目标时只发生上级旋转，本体保持纯净姿态
    const chains = [
      { t: 'IK_LHand', eff: 'mixamorigLeftHand', links: ['mixamorigLeftForeArm', 'mixamorigLeftArm'] },
      { t: 'IK_RHand', eff: 'mixamorigRightHand', links: ['mixamorigRightForeArm', 'mixamorigRightArm'] },
      { t: 'IK_LFoot', eff: 'mixamorigLeftFoot', links: ['mixamorigLeftLeg', 'mixamorigLeftUpLeg'] },
      { t: 'IK_RFoot', eff: 'mixamorigRightFoot', links: ['mixamorigRightLeg', 'mixamorigRightUpLeg'] },
      { t: 'IK_Chest', eff: 'mixamorigSpine2', links: ['mixamorigSpine1', 'mixamorigSpine'] },
      { t: 'IK_Head',  eff: 'mixamorigHead',  links: ['mixamorigNeck'] },
      // 中间过渡关节的专属 IK，允许拖拽它们且不污染其本身的 Rotate
      { t: 'IK_LElbow', eff: 'mixamorigLeftForeArm', links: ['mixamorigLeftArm'] },
      { t: 'IK_RElbow', eff: 'mixamorigRightForeArm', links: ['mixamorigRightArm'] },
      { t: 'IK_LKnee', eff: 'mixamorigLeftLeg', links: ['mixamorigLeftUpLeg'] },
      { t: 'IK_RKnee', eff: 'mixamorigRightLeg', links: ['mixamorigRightUpLeg'] },
      { t: 'IK_Spine1', eff: 'mixamorigSpine1', links: ['mixamorigSpine'] }
    ]

    chains.forEach(c => {
       const hit = scene.getObjectByName(c.t); 
       if (hit) { 
           hit.removeFromParent(); 
           const idx = (sm as any).skeleton.bones.indexOf(hit); 
           if(idx>-1) {
               (sm as any).skeleton.bones.splice(idx, 1);
               (sm as any).skeleton.boneInverses.splice(idx, 1);
           }
       }
    })

    ;['mixamorigLeftLeg', 'mixamorigRightLeg', 'mixamorigLeftForeArm', 'mixamorigRightForeArm', 'mixamorigSpine1'].forEach(n => {
      const b = scene.getObjectByName(n); if (b) { b.rotation.x += 0.05; b.rotation.z += 0.05; b.updateMatrixWorld(true) }
    })

    const iks: any[] = []
    
    // 原生 IK 约束映射：将所有骨骼解剖学限制深度植入到 IK 解算器的核心层中
    // 让解算器自己去规避界限，这是达到“越界瞬间停止”且不鬼畜抖动的数学完美解！
    const halfPI = Math.PI / 2;
    const getPhysicLimits = (bName: string) => {
       if (bName.includes('Head') || bName.includes('Neck')) return { rotationMin: new THREE.Vector3(-halfPI, -halfPI, -Math.PI/4), rotationMax: new THREE.Vector3(halfPI, halfPI, Math.PI/4) };
       if (bName.includes('Spine')) return { rotationMin: new THREE.Vector3(-halfPI, -halfPI, -halfPI), rotationMax: new THREE.Vector3(halfPI, halfPI, halfPI) };
       if (bName.includes('Foot')) return { rotationMin: new THREE.Vector3(-halfPI, -halfPI, -halfPI), rotationMax: new THREE.Vector3(halfPI, halfPI, halfPI) };
       // 大腿 (UpLeg)：赋予极大自由度，前踢后伸劈叉全不限制，左右旋转自如
       if (bName.includes('UpLeg')) return { rotationMin: new THREE.Vector3(-Math.PI, -Math.PI, -halfPI), rotationMax: new THREE.Vector3(Math.PI, Math.PI, halfPI) };
       // 膝盖 (Leg)：X轴强制 180度向前合页弯曲绝不反向，Y与Z轴无任何限制完全释放横向扭动空间
       if (bName.includes('Leg')) return { rotationMin: new THREE.Vector3(0.01, -Math.PI, -Math.PI), rotationMax: new THREE.Vector3(2.8, Math.PI, Math.PI) };
       return {};
    };

    chains.forEach(chain => {
      const tb = new THREE.Bone(); tb.name = chain.t;
      scene.getObjectByName(chain.eff)?.getWorldPosition(tb.position)
      scene.add(tb); 
      (sm as any).skeleton.bones.push(tb);
      (sm as any).skeleton.boneInverses.push(new THREE.Matrix4());
      ikTargetsRef.current[chain.eff] = tb
      
      const effIdx = safeGetIdx(chain.eff);
      const linkArr = chain.links.map(l => ({ index: safeGetIdx(l), ...getPhysicLimits(l) })).filter(l => l.index !== -1);
      
      if (effIdx !== -1 && linkArr.length > 0) {
         iks.push({ effName: chain.eff, target: (sm as any).skeleton.bones.length - 1, effector: effIdx, links: linkArr })
      }
    })

    // 重构 Skeleton 并重新绑定，否则由于骨骼数量增加但逆矩阵没同步更新会导致渲染彻底崩溃！
    const newSkeleton = new THREE.Skeleton((sm as any).skeleton.bones, (sm as any).skeleton.boneInverses);
    (sm as any).bind(newSkeleton, (sm as any).bindMatrix);

    try {
        solverRef.current = new CCDIKSolver(sm as any, iks)
    } catch(e) {
        console.error("IK 解析失败，已进入沙箱保护", e)
    }
    
    // 初始化时缓存初始 T-Pose 姿势状态至全局，供外层一键恢复
    setTimeout(() => {
        const snap = saveSnapshot(scene);
        usePoseStore.getState().pushState(snap);
        if (!(window as any)._initialPose) (window as any)._initialPose = snap;
    }, 200);

    // 为外层高阶 UI (姿势库) 暴漏全局通信 API
    (window as any)._getCurrentPose = () => saveSnapshot(scene);
    (window as any)._loadPose = (snap: any) => { 
        applySnapshot(scene, snap); 
        usePoseStore.getState().pushState(snap);
        // 手动刷新全局 IK Target 到最新的骨骼位置，防止切姿势后直接拖拉发生悬空乱飞
        Object.keys(ikTargetsRef.current).forEach(effName => {
            const t = ikTargetsRef.current[effName]; const b = scene.getObjectByName(effName);
            if (b) b.getWorldPosition(t.position);
        });
    };
    (window as any)._resetPose = () => { if ((window as any)._initialPose) (window as any)._loadPose((window as any)._initialPose); };
    
    // Ctrl+Z Undo bindings
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? usePoseStore.getState().redo(scene) : usePoseStore.getState().undo(scene) }
        if (e.key.toLowerCase() === 'y') { e.preventDefault(); usePoseStore.getState().redo(scene) }
      }
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [scene])

  const bonesToControl = useMemo(() => {
    const list: THREE.Object3D[] = []
    scene.updateMatrixWorld(true)
    scene.traverse(c => {
      if ((c as any).isSkinnedMesh) { (c as any).material = new THREE.MeshStandardMaterial({ color: '#aaaaaa', roughness: 0.5 }); c.receiveShadow = true; c.castShadow = true; (c as any).raycast = () => {} }
      if ((c as any).isBone && CONTROL_BONES.includes(c.name)) list.push(c)
    })
    return list
  }, [scene])

  useFrame(() => {
    if (!solverRef.current) return;

    // 当没有拖拽时，将所有 IK 目标点吸附并实时同步到当前骨骼的真实物理拓扑位置。
    if (!draggingRef.current) {
        Object.keys(ikTargetsRef.current).forEach(effName => {
            const t = ikTargetsRef.current[effName];
            const b = scene.getObjectByName(effName);
            if (b) b.getWorldPosition(t.position);
        });
    } else {
        // 如果发生拖拽，只激活相关的单列子 IK 链条，斩断其他多余解算！
        const activeChains: string[] = [];

        if (draggingRef.current === 'mixamorigHips') {
            // 拖动肚脐/髋骨时：启动【真深蹲】模式！
            // 物理逻辑：只有双脚的目标点被“激活锁死在原位”（activeChain 激活解算来去追赶脚掌被钉碎的原点）。
            // 其他包括手臂、头都不解算，放任它们作为上级枝干自然随骨盆的下沉而后仰或垂落！
            activeChains.push('mixamorigLeftFoot', 'mixamorigRightFoot');
        } else if (draggingRef.current) {
            // 拖动特定的手脚，就完完全全只给这一条手臂/腿进行解算联动！身体其他部位保持原样。
            activeChains.push(draggingRef.current);
        }

        // 将官方全局 CCDIKSolver.update() 拉扯成极为精细的精确射击 .updateOne(ik)
        // 彻底杜绝全局所有链条强制运算带来的毫无逻辑的帕金森式鬼畜抖动：
        if ((solverRef.current as any).iks) {
            (solverRef.current as any).iks.forEach((ik: any) => {
                if (activeChains.includes(ik.effName)) {
                    solverRef.current!.updateOne(ik);
                }
            });
        }
    }

  })

  return (
    <group>
      <primitive object={scene} />
      {bonesToControl.map(bone => (
        <DragNode key={bone.uuid} bone={bone} orbitRef={orbitRef} scene={scene} ikTargetsRef={ikTargetsRef} draggingRef={draggingRef} onSelected={setSelectedBoneName} />
      ))}
      {selectedBoneName && scene.getObjectByName(selectedBoneName) && (
        <TransformControls object={scene.getObjectByName(selectedBoneName)!} mode="rotate" space="local" size={0.5} 
          onMouseDown={(e: any) => { 
              if (orbitRef.current) orbitRef.current.enabled = false;
              if (e && e.target && e.target.object) lastValidQ.current.copy(e.target.object.quaternion);
          }}
          onMouseUp={() => { if (orbitRef.current) orbitRef.current.enabled = true; usePoseStore.getState().pushState(saveSnapshot(scene)) }}
          onChange={(e) => {
             // 极其平滑的隔离拦截探测器：到达临界角后绝对停住不鬼畜抖动
             if (e && (e as any).target && (e as any).target.object) enforceGizmoLimitsWithoutJitter((e as any).target.object);
          }}
        />
      )}
    </group>
  )
}
