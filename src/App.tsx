import { useRef, useEffect, useState, Suspense, useCallback } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Reorder } from 'framer-motion'
import { OrbitControls, Grid, PerspectiveCamera } from '@react-three/drei'
import { Leva, useControls, button } from 'leva'
import * as THREE from 'three'
import { RealHumanoid } from './components/RealHumanoid'

// ── 相机管理 + Leva 控制面板 ─────────────────────────────
function CameraManager() {
  const { camera } = useThree()

  const [{ fov }] = useControls('📷 控制设置', () => ({
    fov: { value: 50, min: 15, max: 120, step: 1, label: 'FOV 视场角' },
    '提取视角坐标': button(() => {
      const p = camera.position
      const r = camera.rotation
      console.log('=== 相机视角信息 ===')
      console.log(`位置 XYZ: ${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)}`)
      console.log(`旋转 XYZ: ${r.x.toFixed(3)}, ${r.y.toFixed(3)}, ${r.z.toFixed(3)}`)
      if (camera instanceof THREE.PerspectiveCamera)
        console.log(`FOV: ${camera.fov}°`)
      alert(`📷 视角已提取！\n位置: (${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})\n请查看控制台 (F12) 获取完整信息。`)
    }),
  }))

  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
  }, [fov, camera])

  return null
}

// ── 主应用 ────────────────────────────────────────────────
export default function App() {
  const orbitRef = useRef<any>(null)
  const cameraRef = useRef<any>(null)
  const [isSpaceDown, setIsSpaceDown] = useState(false)

  const [sideDir, setSideDir] = useState(1) // 1 = right side (+X), -1 = left side (-X)

  const setView = useCallback((type: string, dir?: number) => {
     if (!orbitRef.current || !cameraRef.current) return;
     const cam = cameraRef.current;
     const orbit = orbitRef.current;
     orbit.target.set(0, 1, 0); 
     if (type === 'front') cam.position.set(0, 1.5, 4);
     if (type === 'side') cam.position.set((dir ?? 1) * 4, 1.5, 0);
     if (type === 'top') cam.position.set(0, 4, 0.01);
     orbit.update();
  }, []);

  // 存储当前摄影机快照
  const getCameraSnap = () => {
    if (!cameraRef.current || !orbitRef.current) return null;
    const p = cameraRef.current.position;
    const t = orbitRef.current.target;
    return { px: p.x, py: p.y, pz: p.z, tx: t.x, ty: t.y, tz: t.z };
  }

  // 恢复摄影机快照
  const applyCameraSnap = (snap: any) => {
    if (!snap || !cameraRef.current || !orbitRef.current) return;
    cameraRef.current.position.set(snap.px, snap.py, snap.pz);
    orbitRef.current.target.set(snap.tx, snap.ty, snap.tz);
    orbitRef.current.update();
  }

  // ----------------- 姿势库核心状态与持久化 ----------------- //
  const [showLibrary, setShowLibrary] = useState(false)
  const [poses, setPoses] = useState<any[]>(() => {
     try { return JSON.parse(localStorage.getItem('saved_humanoid_poses') || '[]') } catch { return [] }
  })
  const [editingId, setEditingId] = useState<number|null>(null)
  useEffect(() => { localStorage.setItem('saved_humanoid_poses', JSON.stringify(poses)) }, [poses])

  const saveCurrentPose = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const image = canvas.toDataURL('image/png', 0.4);
    const poseJson = (window as any)._getCurrentPose ? (window as any)._getCurrentPose() : null;
    if (poseJson) {
       const now = new Date();
       const name = `姿势 ${now.getMonth()+1}-${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;
       const camera = getCameraSnap();
       setPoses(prev => [...prev, { id: Date.now(), name, image, data: poseJson, camera }]);
    }
  }

  const renamePose = (id: number, newName: string) => {
    setPoses(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p));
    setEditingId(null);
  }

  // --- 姿势库浮窗拖拽原生钩子 --- //
  const panelRef = useRef<HTMLDivElement>(null)
  const dragState = useRef({ isDragging: false, ox: 0, oy: 0, x: 20, y: 70 })

  const handlePointerDown = (e: React.PointerEvent) => {
      dragState.current.isDragging = true;
      dragState.current.ox = e.clientX - dragState.current.x;
      dragState.current.oy = e.clientY - dragState.current.y;
      e.currentTarget.setPointerCapture(e.pointerId);
  }
  const handlePointerMove = (e: React.PointerEvent) => {
      if (!dragState.current.isDragging) return;
      const newX = Math.max(0, Math.min(window.innerWidth - 300, e.clientX - dragState.current.ox));
      const newY = Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragState.current.oy));
      dragState.current.x = newX;
      dragState.current.y = newY;
      if (panelRef.current) panelRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
  }
  const handlePointerUp = (e: React.PointerEvent) => {
      dragState.current.isDragging = false;
      e.currentTarget.releasePointerCapture(e.pointerId);
  }

  // 监听空格键进行平移
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        setIsSpaceDown(true)
        document.body.style.cursor = 'move'
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpaceDown(false)
        document.body.style.cursor = 'auto'
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#111416' }}>
      {/* 左上角标题 */}
      <div style={{
        position: 'absolute', top: 20, left: 20, zIndex: 10, pointerEvents: 'none',
      }}>
        <h1 style={{ margin: 0, fontSize: '18px', color: '#e8eaf0', letterSpacing: '0.04em' }}>
          3D-to-AIGC 空间视效控制台
          <span style={{ marginLeft: 10, fontSize: '11px', color: '#6688cc', fontWeight: 400 }}>真实人偶版</span>
        </h1>
        <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#778899', lineHeight: '1.5' }}>
          <b>1. 拖拉式全身 IK</b>：鼠标按住 <span style={{ color: '#aaddff' }}>蓝白色小球不放</span> 即可向任意方向拖动，直接产生顺滑的自然联动（例如下压臀部下蹲）。本功能与网格位移强制断联，完全不撕扯模型！<br/>
          <b>2. 万向旋转 FK</b>：单击点选任意蓝球，经典的 360° 红绿蓝旋转仪就会挂载出现。用来处理膝盖和手腕的细致微调。<br/>
          <b>3. 撤销重做支持</b>：快捷键 `Ctrl+Z` 撤销动作，`Ctrl+Y` 重做动作。<br/>
          <b>4. 镜头平移</b>：按住键盘 `空格键` 再用鼠标拖动画布，顺滑平移视图。
        </p>
      </div>

      {/* 隐藏并封杀掉 Leva 顶部无关痛痒的英文搜索栏提示 */}
      <Leva titleBar={{ title: '控制台设置', filter: false }} hideCopyButton />

      {/* 左侧工具栏：复位 + 姿势库入口 */}
      <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10, display: 'flex', gap: '10px', marginTop: 160 }}>
          <button onClick={() => (window as any)._resetPose?.()} style={{ padding: '10px 18px', background: '#222', color: '#ffcc00', border: '1px solid #ffcc00', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: 13 }}>⟲ 复位 T-Pose</button>
          <button onClick={() => setShowLibrary(!showLibrary)} style={{ padding: '10px 18px', background: showLibrary ? '#00ff88' : '#222', color: showLibrary ? '#000' : '#00ff88', border: '1px solid #00ff88', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: 13 }}>📚 姿势库</button>
      </div>

      {/* 姿势库高级原生浮动窗口 */}
      {showLibrary && (
      <div ref={panelRef} style={{
          position: 'absolute', left: 0, top: 0, width: 340, maxHeight: '85vh', 
          transform: `translate(${dragState.current.x}px, ${dragState.current.y}px)`,
          background: 'rgba(26, 29, 36, 0.95)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px',
          zIndex: 100, display: 'flex', flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
          willChange: 'transform'
      }}>
         {/* 窗口头部拖拽控制抛物线区 */}
         <div 
             onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}
             style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', cursor: 'move', background: 'rgba(0,0,0,0.4)', borderTopLeftRadius: '12px', borderTopRightRadius: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', userSelect: 'none' }}
         >
             <h2 style={{ margin: 0, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6, pointerEvents: 'none', color: '#ddd', fontWeight: 600 }}><span style={{fontSize: 18}}>📂</span> 姿势浮动资源面板</h2>
             <button onPointerDown={e => e.stopPropagation()} onClick={() => setShowLibrary(false)} style={{ background: 'transparent', color: '#888', border: 'none', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: 0 }}>×</button>
         </div>

         {/* 滚动视口内容区 */}
         <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
             <button onClick={saveCurrentPose} style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #0d8df3, #00d2ff)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', marginBottom: 20, fontSize: 13, letterSpacing: '0.04em', boxShadow: '0 4px 15px rgba(0, 210, 255, 0.3)', transition: 'transform 0.2s', ':active': { transform: 'scale(0.98)' } } as any}>+ 截屏幕创建新姿态</button>
             
             <Reorder.Group axis="y" values={poses} onReorder={setPoses} style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: 0, margin: 0, listStyle: 'none' }}>
             {poses.map((p: any) => (
                 <Reorder.Item key={p.id} value={p}
                     whileDrag={{ scale: 1.05, boxShadow: '0 15px 35px rgba(0, 210, 255, 0.35)', cursor: 'grabbing', borderColor: '#00d2ff', backgroundColor: '#3a4050' }}
                     style={{ 
                         background: '#2a2e38', borderRadius: '8px', overflow: 'hidden', 
                         position: 'relative', border: '1px solid #444', 
                         cursor: 'grab'
                     }}
                 >
                     <div onPointerDown={(e) => { e.stopPropagation(); if ((window as any)._loadPose) { (window as any)._loadPose(p.data); applyCameraSnap(p.camera); } }} style={{ width: '100%', height: 120, position: 'relative' }}>
                         <img draggable={false} src={p.image} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', userSelect: 'none', pointerEvents: 'none' }} title="按住拖拽或点击加载" alt="pose-thumb"/>
                     </div>
                     <div onPointerDown={e => e.stopPropagation()} style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, cursor: 'default' }}>
                         {editingId === p.id ? (
                             <input autoFocus defaultValue={p.name || '未命名'} 
                                 onBlur={(e) => renamePose(p.id, e.target.value)} 
                                 onKeyDown={(e) => { if (e.key === 'Enter') renamePose(p.id, (e.target as HTMLInputElement).value) }}
                                 style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #00d2ff', borderRadius: '3px', padding: '4px 6px', fontSize: 12, outline: 'none' }}
                             />
                         ) : (
                             <span onDoubleClick={() => setEditingId(p.id)} style={{ flex: 1, fontSize: 12, color: '#ccc', cursor: 'text', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', userSelect: 'none' }} title="双击重命名">{p.name || '未命名'}</span>
                         )}
                         <button onClick={() => setPoses(prev => prev.filter((x: any) => x.id !== p.id))} style={{ background: 'rgba(255,60,60,0.8)', color: 'white', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
                     </div>
                 </Reorder.Item>
             ))}
             </Reorder.Group>
             {poses.length === 0 && <div style={{ textAlign: 'center', color: '#666', marginTop: 40, fontSize: 13 }}>系统空置中，请保存任一节点图层序列</div>}
         </div>
      </div>
      )}

      {/* 视图切换面板 (Bottom HUD) */}
      <div style={{ position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', gap: '15px' }}>
         <button onClick={(e) => { e.stopPropagation(); setView('front') }} style={{ padding: '10px 20px', background: '#222', color: '#00d2ff', border: '1px solid #00d2ff', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Front View (正视)</button>
         <button onClick={(e) => { e.stopPropagation(); const next = -sideDir; setSideDir(next); setView('side', next); }} style={{ padding: '10px 20px', background: '#222', color: '#00d2ff', border: '1px solid #00d2ff', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>{sideDir === 1 ? 'Left Side View ←' : 'Right Side View →'}</button>
         <button onClick={(e) => { e.stopPropagation(); setView('top') }} style={{ padding: '10px 20px', background: '#222', color: '#00d2ff', border: '1px solid #00d2ff', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Top View (顶视)</button>
      </div>

      <Canvas
        shadows
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        onPointerMissed={() => window.dispatchEvent(new CustomEvent('clear-selection'))}
      >
        <PerspectiveCamera ref={cameraRef} makeDefault position={[0, 1.5, 4]} fov={50} />
        <CameraManager />

        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 10, 5]} intensity={1.8} castShadow shadow-mapSize={2048} />
        <directionalLight position={[-5, 5, -5]} intensity={0.4} />

        <Grid
          position={[0, -0.01, 0]}
          args={[20, 20]}
          cellSize={0.5}
          cellColor="#2a2e38"
          sectionSize={2}
          sectionColor="#3a4050"
          fadeDistance={20}
        />

        {/* 阴影接收地面 */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[50, 50]} />
          <shadowMaterial transparent opacity={0.35} />
        </mesh>

        {/* 真实 3D 骨骼人偶 */}
        <Suspense fallback={null}>
          <RealHumanoid orbitRef={orbitRef} />
        </Suspense>

        {/* 轨道控制器：根据是否按住空格键，动态切换鼠标左键功能（旋转 or 平移） */}
        <OrbitControls 
          ref={orbitRef} 
          makeDefault 
          enableDamping 
          dampingFactor={0.06} 
          mouseButtons={{
            LEFT: isSpaceDown ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN
          }}
        />
      </Canvas>
    </div>
  )
}
