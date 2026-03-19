import { useRef, useState, useMemo, useCallback, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  JOINT_COUNT, BONES, BODY_SEGMENTS,
  DRAGGABLE, IK_CHAINS, POLE_VECTORS, CHILDREN_MAP,
  getDefaultPose, getLimbLengths, solve2BoneIK,
} from '../humanoid'

const UP = new THREE.Vector3(0, 1, 0)

// ── 半透明人体外形段 ─────────────────────────────────────
function BodySegment({ start, end, radiusBot }: {
  start: THREE.Vector3; end: THREE.Vector3
  radiusTop: number; radiusBot: number
}) {
  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5)
  const dir = new THREE.Vector3().subVectors(end, start)
  const len = dir.length()
  if (len < 0.001) return null
  const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize())
  return (
    <mesh position={mid.toArray()} quaternion={q}>
      <capsuleGeometry args={[radiusBot, len * 0.7, 8, 16]} />
      <meshPhysicalMaterial
        color="#8899aa"
        transparent
        opacity={0.35}
        roughness={0.5}
        metalness={0.1}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

// ── 头部球体 ─────────────────────────────────────────────
function HeadMesh({ position }: { position: THREE.Vector3 }) {
  return (
    <mesh position={position.toArray()}>
      <sphereGeometry args={[0.10, 24, 24]} />
      <meshPhysicalMaterial
        color="#8899aa"
        transparent opacity={0.35}
        roughness={0.5} metalness={0.1}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

// ── 隐藏的骨骼连线（暗线） ───────────────────────────────
function BoneLine({ start, end }: { start: THREE.Vector3; end: THREE.Vector3 }) {
  const dir = new THREE.Vector3().subVectors(end, start)
  const len = dir.length()
  if (len < 0.001) return null
  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5)
  const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize())
  return (
    <mesh position={mid.toArray()} quaternion={q}>
      <cylinderGeometry args={[0.008, 0.008, len, 6]} />
      <meshBasicMaterial color="#55aadd" transparent opacity={0.5} />
    </mesh>
  )
}

// ── 关节控制球 ───────────────────────────────────────────
function JointSphere({ position, draggable, selected, onPointerDown }: {
  position: THREE.Vector3; draggable: boolean
  selected: boolean; onPointerDown?: (e: any) => void
}) {
  const [hovered, setHovered] = useState(false)
  const radius = draggable ? 0.032 : 0.018
  const baseColor = '#44bbff'
  const color = selected ? '#ffffff' : (hovered ? '#88ddff' : baseColor)
  const emissive = selected || hovered ? '#44aaff' : '#115588'

  useEffect(() => {
    document.body.style.cursor = hovered && draggable ? 'grab' : 'auto'
    return () => { document.body.style.cursor = 'auto' }
  }, [hovered, draggable])

  return (
    <mesh
      position={position.toArray()}
      onPointerDown={draggable ? onPointerDown : undefined}
      onPointerEnter={draggable ? () => setHovered(true) : undefined}
      onPointerLeave={draggable ? () => setHovered(false) : undefined}
    >
      <sphereGeometry args={[radius, 16, 16]} />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={selected ? 1.0 : 0.6}
        roughness={0.15} metalness={0.7}
      />
    </mesh>
  )
}

// ══════════════════════════════════════════════════════════
// 主组件
// ══════════════════════════════════════════════════════════
export function HumanoidFigure({ orbitRef }: { orbitRef: React.RefObject<any> }) {
  const { camera, gl } = useThree()
  const [joints, setJoints] = useState<THREE.Vector3[]>(getDefaultPose)
  const [selected, setSelected] = useState<number | null>(null)

  const draggingRef = useRef<number | null>(null)
  const dragPlane = useRef(new THREE.Plane())
  const raycaster = useRef(new THREE.Raycaster())
  const hitPoint = useRef(new THREE.Vector3())
  const prevHit = useRef(new THREE.Vector3())

  const limbLengths = useMemo(getLimbLengths, [])

  // ─── 开始拖拽 ──────────────────────────────────────────
  const handlePointerDown = useCallback((e: any, idx: number) => {
    e.stopPropagation()
    draggingRef.current = idx
    setSelected(idx)
    if (orbitRef.current) orbitRef.current.enabled = false
    const camDir = new THREE.Vector3()
    camera.getWorldDirection(camDir)
    dragPlane.current.setFromNormalAndCoplanarPoint(camDir.negate(), joints[idx])
    prevHit.current.copy(joints[idx])
    gl.domElement.setPointerCapture(e.pointerId)
  }, [camera, gl, joints, orbitRef])

  // ─── 拖拽中 ────────────────────────────────────────────
  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (draggingRef.current === null) return
    const rect = gl.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    )
    raycaster.current.setFromCamera(mouse, camera)
    if (!raycaster.current.ray.intersectPlane(dragPlane.current, hitPoint.current)) return

    const tipIdx = draggingRef.current
    const newTip = hitPoint.current.clone()
    const delta = new THREE.Vector3().subVectors(newTip, prevHit.current)
    prevHit.current.copy(newTip)

    setJoints(prev => {
      const next = prev.map(p => p.clone())
      const chain = IK_CHAINS[tipIdx]

      if (chain) {
        // IK 解算
        const [, mid, root] = chain
        const [upperLen, lowerLen] = limbLengths[tipIdx]
        const pole = POLE_VECTORS[tipIdx]
        const newMid = solve2BoneIK(next[root], newTip, upperLen, lowerLen, pole)
        next[mid] = newMid
        const tipDir = new THREE.Vector3().subVectors(newTip, newMid).normalize()
        next[tipIdx] = new THREE.Vector3().addVectors(newMid, tipDir.multiplyScalar(lowerLen))
        // 子关节跟随
        const children = CHILDREN_MAP[tipIdx]
        if (children) {
          const actualDelta = new THREE.Vector3().subVectors(next[tipIdx], prev[tipIdx])
          for (const c of children) next[c].add(actualDelta)
        }
      } else if (CHILDREN_MAP[tipIdx]) {
        // 躯干/整体拖动 → 子关节全跟随
        next[tipIdx].add(delta)
        for (const c of CHILDREN_MAP[tipIdx]) next[c].add(delta)
      } else {
        // 末端自由关节 (HEAD, 指尖, 脚趾)
        next[tipIdx] = newTip
      }
      return next
    })
  }, [camera, gl, limbLengths])

  // ─── 结束拖拽 ──────────────────────────────────────────
  const handlePointerUp = useCallback(() => {
    draggingRef.current = null
    if (orbitRef.current) orbitRef.current.enabled = true
  }, [orbitRef])

  useEffect(() => {
    const dom = gl.domElement
    dom.addEventListener('pointermove', handlePointerMove)
    dom.addEventListener('pointerup', handlePointerUp)
    return () => {
      dom.removeEventListener('pointermove', handlePointerMove)
      dom.removeEventListener('pointerup', handlePointerUp)
    }
  }, [gl, handlePointerMove, handlePointerUp])

  return (
    <group>
      {/* 半透明人体外形 */}
      {BODY_SEGMENTS.map((seg, i) => (
        <BodySegment
          key={`body-${i}`}
          start={joints[seg.a]} end={joints[seg.b]}
          radiusTop={seg.radiusTop} radiusBot={seg.radiusBot}
        />
      ))}
      {/* 头部 */}
      <HeadMesh position={joints[0]} />

      {/* 骨骼暗线 */}
      {BONES.map(([a, b], i) => (
        <BoneLine key={`bone-${i}`} start={joints[a]} end={joints[b]} />
      ))}

      {/* 关节控制球 */}
      {Array.from({ length: JOINT_COUNT }, (_, i) => (
        <JointSphere
          key={`j-${i}`}
          position={joints[i]}
          draggable={DRAGGABLE.has(i as any)}
          selected={selected === i}
          onPointerDown={(e) => handlePointerDown(e, i)}
        />
      ))}
    </group>
  )
}
