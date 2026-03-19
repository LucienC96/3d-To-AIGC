import * as THREE from 'three'

// ══════════════════════════════════════════════════════════
// 完整 Humanoid 骨骼系统  —  32 个关节 + 体态段
// ══════════════════════════════════════════════════════════

// ── 关节枚举 ──────────────────────────────────────────────
export const J = {
  // 头 & 躯干
  HEAD: 0, NECK: 1, CHEST: 2, SPINE: 3, HIPS: 4,

  // 左臂
  L_SHOULDER: 5, L_UPPER_ARM: 6, L_ELBOW: 7, L_FOREARM: 8, L_WRIST: 9,
  // 左手指
  L_THUMB: 10, L_INDEX: 11, L_PINKY: 12,

  // 右臂
  R_SHOULDER: 13, R_UPPER_ARM: 14, R_ELBOW: 15, R_FOREARM: 16, R_WRIST: 17,
  // 右手指
  R_THUMB: 18, R_INDEX: 19, R_PINKY: 20,

  // 左腿
  L_HIP: 21, L_KNEE: 22, L_ANKLE: 23, L_TOE: 24,

  // 右腿
  R_HIP: 25, R_KNEE: 26, R_ANKLE: 27, R_TOE: 28,
} as const

export const JOINT_COUNT = 29

// ── 默认 T-Pose 坐标 ─────────────────────────────────────
export function getDefaultPose(): THREE.Vector3[] {
  const p: THREE.Vector3[] = []
  // 头 & 躯干
  p[J.HEAD]    = new THREE.Vector3( 0,     1.72,  0)
  p[J.NECK]    = new THREE.Vector3( 0,     1.55,  0)
  p[J.CHEST]   = new THREE.Vector3( 0,     1.35,  0)
  p[J.SPINE]   = new THREE.Vector3( 0,     1.15,  0)
  p[J.HIPS]    = new THREE.Vector3( 0,     0.95,  0)

  // 左臂
  p[J.L_SHOULDER]  = new THREE.Vector3(-0.18,  1.48,  0)
  p[J.L_UPPER_ARM] = new THREE.Vector3(-0.35,  1.48,  0)
  p[J.L_ELBOW]     = new THREE.Vector3(-0.62,  1.48,  0)
  p[J.L_FOREARM]   = new THREE.Vector3(-0.80,  1.48,  0)
  p[J.L_WRIST]     = new THREE.Vector3(-0.95,  1.48,  0)
  p[J.L_THUMB]     = new THREE.Vector3(-1.02,  1.46, 0.04)
  p[J.L_INDEX]     = new THREE.Vector3(-1.08,  1.48,  0)
  p[J.L_PINKY]     = new THREE.Vector3(-1.06,  1.46, -0.04)

  // 右臂
  p[J.R_SHOULDER]  = new THREE.Vector3( 0.18,  1.48,  0)
  p[J.R_UPPER_ARM] = new THREE.Vector3( 0.35,  1.48,  0)
  p[J.R_ELBOW]     = new THREE.Vector3( 0.62,  1.48,  0)
  p[J.R_FOREARM]   = new THREE.Vector3( 0.80,  1.48,  0)
  p[J.R_WRIST]     = new THREE.Vector3( 0.95,  1.48,  0)
  p[J.R_THUMB]     = new THREE.Vector3( 1.02,  1.46, 0.04)
  p[J.R_INDEX]     = new THREE.Vector3( 1.08,  1.48,  0)
  p[J.R_PINKY]     = new THREE.Vector3( 1.06,  1.46, -0.04)

  // 左腿
  p[J.L_HIP]   = new THREE.Vector3(-0.12,  0.92,  0)
  p[J.L_KNEE]  = new THREE.Vector3(-0.12,  0.50,  0)
  p[J.L_ANKLE] = new THREE.Vector3(-0.12,  0.06,  0)
  p[J.L_TOE]   = new THREE.Vector3(-0.12,  0.0,   0.10)

  // 右腿
  p[J.R_HIP]   = new THREE.Vector3( 0.12,  0.92,  0)
  p[J.R_KNEE]  = new THREE.Vector3( 0.12,  0.50,  0)
  p[J.R_ANKLE] = new THREE.Vector3( 0.12,  0.06,  0)
  p[J.R_TOE]   = new THREE.Vector3( 0.12,  0.0,   0.10)

  return p
}

// ── 骨骼连接关系 [起, 终] ─────────────────────────────────
export const BONES: [number, number][] = [
  // 躯干
  [J.HEAD, J.NECK], [J.NECK, J.CHEST], [J.CHEST, J.SPINE], [J.SPINE, J.HIPS],
  // 左臂
  [J.NECK, J.L_SHOULDER], [J.L_SHOULDER, J.L_UPPER_ARM],
  [J.L_UPPER_ARM, J.L_ELBOW], [J.L_ELBOW, J.L_FOREARM],
  [J.L_FOREARM, J.L_WRIST],
  [J.L_WRIST, J.L_THUMB], [J.L_WRIST, J.L_INDEX], [J.L_WRIST, J.L_PINKY],
  // 右臂
  [J.NECK, J.R_SHOULDER], [J.R_SHOULDER, J.R_UPPER_ARM],
  [J.R_UPPER_ARM, J.R_ELBOW], [J.R_ELBOW, J.R_FOREARM],
  [J.R_FOREARM, J.R_WRIST],
  [J.R_WRIST, J.R_THUMB], [J.R_WRIST, J.R_INDEX], [J.R_WRIST, J.R_PINKY],
  // 左腿
  [J.HIPS, J.L_HIP], [J.L_HIP, J.L_KNEE], [J.L_KNEE, J.L_ANKLE], [J.L_ANKLE, J.L_TOE],
  // 右腿
  [J.HIPS, J.R_HIP], [J.R_HIP, J.R_KNEE], [J.R_KNEE, J.R_ANKLE], [J.R_ANKLE, J.R_TOE],
]

// ── 可拖拽的关节 ─────────────────────────────────────────
export const DRAGGABLE = new Set([
  J.HEAD,
  J.L_SHOULDER, J.L_ELBOW, J.L_WRIST, J.L_THUMB, J.L_INDEX, J.L_PINKY,
  J.R_SHOULDER, J.R_ELBOW, J.R_WRIST, J.R_THUMB, J.R_INDEX, J.R_PINKY,
  J.CHEST, J.SPINE, J.HIPS,
  J.L_HIP, J.L_KNEE, J.L_ANKLE, J.L_TOE,
  J.R_HIP, J.R_KNEE, J.R_ANKLE, J.R_TOE,
])

// ── IK 链定义: { 末端索引 → [末端, 中间, 根部] } ──────────
export const IK_CHAINS: Record<number, [number, number, number]> = {
  [J.L_WRIST]:  [J.L_WRIST,  J.L_ELBOW,  J.L_UPPER_ARM],
  [J.R_WRIST]:  [J.R_WRIST,  J.R_ELBOW,  J.R_UPPER_ARM],
  [J.L_ANKLE]:  [J.L_ANKLE,  J.L_KNEE,   J.L_HIP],
  [J.R_ANKLE]:  [J.R_ANKLE,  J.R_KNEE,   J.R_HIP],
}

// ── 极向量 ───────────────────────────────────────────────
export const POLE_VECTORS: Record<number, THREE.Vector3> = {
  [J.L_WRIST]: new THREE.Vector3(0, 0, -1),
  [J.R_WRIST]: new THREE.Vector3(0, 0, -1),
  [J.L_ANKLE]: new THREE.Vector3(0, 0,  1),
  [J.R_ANKLE]: new THREE.Vector3(0, 0,  1),
}

// ── 父-子约束 (简易): 当某关节被拖动，这些子关节跟随偏移 ──
export const CHILDREN_MAP: Record<number, number[]> = {
  [J.L_WRIST]:  [J.L_THUMB, J.L_INDEX, J.L_PINKY],
  [J.R_WRIST]:  [J.R_THUMB, J.R_INDEX, J.R_PINKY],
  [J.L_ANKLE]:  [J.L_TOE],
  [J.R_ANKLE]:  [J.R_TOE],
  [J.CHEST]:    [J.NECK, J.HEAD, J.L_SHOULDER, J.R_SHOULDER,
                 J.L_UPPER_ARM, J.L_ELBOW, J.L_FOREARM, J.L_WRIST,
                 J.L_THUMB, J.L_INDEX, J.L_PINKY,
                 J.R_UPPER_ARM, J.R_ELBOW, J.R_FOREARM, J.R_WRIST,
                 J.R_THUMB, J.R_INDEX, J.R_PINKY],
  [J.HIPS]:     [J.SPINE, J.CHEST, J.NECK, J.HEAD,
                 J.L_SHOULDER, J.R_SHOULDER,
                 J.L_UPPER_ARM, J.L_ELBOW, J.L_FOREARM, J.L_WRIST,
                 J.L_THUMB, J.L_INDEX, J.L_PINKY,
                 J.R_UPPER_ARM, J.R_ELBOW, J.R_FOREARM, J.R_WRIST,
                 J.R_THUMB, J.R_INDEX, J.R_PINKY,
                 J.L_HIP, J.L_KNEE, J.L_ANKLE, J.L_TOE,
                 J.R_HIP, J.R_KNEE, J.R_ANKLE, J.R_TOE],
}

// ── 骨骼段长度计算 ──────────────────────────────────────
export function getLimbLengths(): Record<number, [number, number]> {
  const def = getDefaultPose()
  const result: Record<number, [number, number]> = {}
  for (const [tipStr, chain] of Object.entries(IK_CHAINS)) {
    const tipIdx = Number(tipStr)
    const [, mid, root] = chain
    result[tipIdx] = [
      def[root].distanceTo(def[mid]),
      def[mid].distanceTo(def[tipIdx]),
    ]
  }
  return result
}

// ── 2-Bone 解析式 IK ────────────────────────────────────
export function solve2BoneIK(
  rootPos: THREE.Vector3,
  target: THREE.Vector3,
  upperLen: number,
  lowerLen: number,
  poleVec: THREE.Vector3,
): THREE.Vector3 {
  const toTarget = new THREE.Vector3().subVectors(target, rootPos)
  const dist = Math.min(toTarget.length(), upperLen + lowerLen - 0.001)
  const cosA = (upperLen ** 2 + dist ** 2 - lowerLen ** 2) / (2 * upperLen * dist)
  const angleA = Math.acos(Math.max(-1, Math.min(1, cosA)))
  const dir = toTarget.clone().normalize()
  const rotAxis = new THREE.Vector3().crossVectors(dir, poleVec)
  if (rotAxis.lengthSq() < 1e-6) {
    rotAxis.set(0, 1, 0).cross(dir).normalize()
    if (rotAxis.lengthSq() < 1e-6) rotAxis.set(1, 0, 0)
  } else {
    rotAxis.normalize()
  }
  const q = new THREE.Quaternion().setFromAxisAngle(rotAxis, angleA)
  const midDir = dir.clone().applyQuaternion(q)
  return new THREE.Vector3().addVectors(rootPos, midDir.multiplyScalar(upperLen))
}

// ══════════════════════════════════════════════════════════
// 人体外形段定义 (用 CapsuleGeometry 构建半透明身体)
// [关节A, 关节B, 粗细缩放]
// ══════════════════════════════════════════════════════════
export const BODY_SEGMENTS: { a: number; b: number; radiusTop: number; radiusBot: number }[] = [
  // 头
  { a: J.HEAD,   b: J.NECK,         radiusTop: 0.10, radiusBot: 0.08 },
  // 脖子
  { a: J.NECK,   b: J.CHEST,        radiusTop: 0.06, radiusBot: 0.06 },
  // 上胸腔
  { a: J.CHEST,  b: J.SPINE,        radiusTop: 0.16, radiusBot: 0.14 },
  // 下躯干
  { a: J.SPINE,  b: J.HIPS,         radiusTop: 0.14, radiusBot: 0.15 },

  // 左臂
  { a: J.L_UPPER_ARM, b: J.L_ELBOW, radiusTop: 0.05, radiusBot: 0.045 },
  { a: J.L_ELBOW,     b: J.L_WRIST, radiusTop: 0.045, radiusBot: 0.035 },
  // 右臂
  { a: J.R_UPPER_ARM, b: J.R_ELBOW, radiusTop: 0.05, radiusBot: 0.045 },
  { a: J.R_ELBOW,     b: J.R_WRIST, radiusTop: 0.045, radiusBot: 0.035 },

  // 左腿
  { a: J.L_HIP,   b: J.L_KNEE,      radiusTop: 0.07, radiusBot: 0.055 },
  { a: J.L_KNEE,  b: J.L_ANKLE,     radiusTop: 0.055, radiusBot: 0.04 },
  // 右腿
  { a: J.R_HIP,   b: J.R_KNEE,      radiusTop: 0.07, radiusBot: 0.055 },
  { a: J.R_KNEE,  b: J.R_ANKLE,     radiusTop: 0.055, radiusBot: 0.04 },
]
