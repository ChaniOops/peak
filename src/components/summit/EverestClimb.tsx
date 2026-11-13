import { useEffect, useRef, useState } from 'react'
import { animate, motion, useReducedMotion } from 'framer-motion'
import s from './everestClimb.module.css'

/**
 * Procedural WebGL Everest with a glowing route — the FeralUI ClimbScreen
 * visual, reframed for the wide SummitCard. The route head is driven purely by
 * steps / goalSteps. The "You're here" altitude is a display-only
 * Everest-equivalent of that progress; nothing else reads it.
 *
 * Terrain + route geometry are generated once per page load and cached.
 * Live step updates only tween the route head; the intro never replays.
 */

export type EverestClimbProps = {
  steps: number
  goalSteps?: number
  className?: string
}

const SOFT_EASE: [number, number, number, number] = [0.22, 1, 0.3, 1]
/** seconds for the route head to glide to a new live value */
const LIVE_TWEEN_S = 0.5

// FeralUI atmosphere (#0b1321)
const HAZE: [number, number, number] = [0.043, 0.075, 0.13]

// ---------------------------------------------------------------------------
// Terrain (unchanged from the supplied implementation; CL_SUMMIT_M is only the
// height scale of the model, not anything the user has achieved)

const CL_SUMMIT_M = 8849
const CL_X0 = -1.35
const CL_X1 = 1.35
const CL_Z0 = -1.3
const CL_Z1 = 1.4
const CL_NX = 220
const CL_NZ = 236
const CL_FLOOR_M = 2000
const CL_VSCALE = 0.6

const CL_ROUTE_PTS: [number, number, number][] = [
  [0.02, -1.08, 2860],
  [-0.02, -0.84, 2835],
  [-0.1, -0.6, 3440],
  [0.06, -0.36, 3867],
  [0.17, -0.19, 3985],
  [0.21, -0.03, 4410],
  [0.03, 0.11, 4620],
  [-0.13, 0.22, 4940],
  [-0.26, 0.34, 5164],
  [-0.24, 0.43, 5364],
  [-0.13, 0.46, 6065],
  [-0.03, 0.46, 6400],
  [0.06, 0.49, 7162],
  [0.07, 0.555, 7906],
  [0.0, 0.62, CL_SUMMIT_M],
]

const CL_TREK_END = 9

const CL_PEAKS: [number, number, number, number, number][] = [
  [0.0, 0.62, 8849, 0.34, 0.75],
  [0.15, 0.53, 8516, 0.27, 0.6],
  [-0.13, 0.33, 7861, 0.17, 0.3],
  [-0.44, 0.64, 7161, 0.22, 0.65],
  [0.4, -0.12, 6812, 0.16, 0.85],
  [0.3, -0.72, 6623, 0.2, 0.5],
  [0.46, -0.44, 6782, 0.2, 0.4],
  [-0.52, -0.66, 6187, 0.24, 0.3],
  [-0.24, -0.1, 6495, 0.16, 0.6],
  [-0.4, 0.1, 6440, 0.17, 0.6],
  [0.48, 0.24, 6189, 0.18, 0.5],
  [1.05, 0.75, 8485, 0.4, 0.6],
  [-1.05, 0.95, 8188, 0.42, 0.5],
]

const clHash = (x: number, y: number) => {
  const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return v - Math.floor(v)
}

function clNoise(x: number, y: number) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10)
  const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10)
  const a = clHash(ix, iy)
  const b = clHash(ix + 1, iy)
  const c = clHash(ix, iy + 1)
  const d = clHash(ix + 1, iy + 1)
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy
}

function clRidged(x: number, y: number, octaves: number) {
  let v = 0
  let amp = 0.5
  let px = x
  let py = y
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(clNoise(px, py) * 2 - 1)
    v += n * n * amp
    const rx = (px * 0.8 - py * 0.6) * 2.03 + 17.3
    py = (px * 0.6 + py * 0.8) * 2.03 + 5.1
    px = rx
    amp *= 0.5
  }
  return v
}

const clSmooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

const clSmax = (a: number, b: number, k: number) => {
  const h = Math.min(1, Math.max(0, 0.5 + (b - a) / (2 * k)))
  return a + (b - a) * h + k * h * (1 - h)
}

const clSmin = (a: number, b: number, k: number) => -clSmax(-a, -b, k)

const CL_TREK = CL_ROUTE_PTS.slice(0, CL_TREK_END + 1)

function clElevation(x: number, z: number) {
  const north = clSmooth(-1.2, 0.9, z)
  let h = 2300 + 2400 * north + clRidged(x * 2.4 + 7.3, z * 2.4 + 1.9, 4) * (1500 + 1900 * north)
  for (const [px, pz, pm, r, tri] of CL_PEAKS) {
    const dx = x - px
    const dz = z - pz
    const round = Math.hypot(dx, dz)
    const faces = Math.max(dx * 0.5 + dz * 0.866, dx * 0.5 - dz * 0.866, -dx) * 1.3
    const d = round * (1 - tri) + faces * tri
    const warp = 1 + (clNoise(x * 7 + px * 13, z * 7 + pz * 11) - 0.5) * 0.5
    const k = Math.max(0, 1 - (d * warp) / r)
    if (k <= 0) continue
    const flank = (clRidged(x * 6 + px * 5, z * 6 + pz * 5, 2) - 0.34) * 1500 * k * (1 - k) * 4
    const cone = h + (pm - h) * Math.pow(k, 1.35) + flank
    h = clSmax(h, cone, 260)
  }

  let best = 1e9
  let floorM = 0
  for (let i = 0; i < CL_TREK.length - 1; i++) {
    const [ax, az, am] = CL_TREK[i]
    const [bx, bz, bm] = CL_TREK[i + 1]
    const vx = bx - ax
    const vz = bz - az
    const f = Math.min(1, Math.max(0, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)))
    const qx = ax + vx * f - x
    const qz = az + vz * f - z
    const d = qx * qx + qz * qz
    if (d < best) {
      best = d
      floorM = am + (bm - am) * f
    }
  }
  const dist = Math.sqrt(best)
  return clSmin(h, floorM - 40 + 30000 * Math.pow(dist, 1.5), 320)
}

type ClTerrain = { heights: Float32Array; mesh: Float32Array; index: Uint16Array | Uint32Array; count: number }

function clTerrain(): ClTerrain {
  const heights = new Float32Array(CL_NX * CL_NZ)
  for (let j = 0; j < CL_NZ; j++) {
    for (let i = 0; i < CL_NX; i++) {
      heights[j * CL_NX + i] = clElevation(CL_X0 + ((CL_X1 - CL_X0) * i) / (CL_NX - 1), CL_Z0 + ((CL_Z1 - CL_Z0) * j) / (CL_NZ - 1))
    }
  }
  const dx = (CL_X1 - CL_X0) / (CL_NX - 1)
  const dz = (CL_Z1 - CL_Z0) / (CL_NZ - 1)
  const toY = CL_VSCALE / CL_SUMMIT_M
  const at = (ii: number, jj: number) => heights[Math.min(CL_NZ - 1, Math.max(0, jj)) * CL_NX + Math.min(CL_NX - 1, Math.max(0, ii))]
  const mesh = new Float32Array(CL_NX * CL_NZ * 5)
  for (let j = 0; j < CL_NZ; j++) {
    for (let i = 0; i < CL_NX; i++) {
      const o = (j * CL_NX + i) * 5
      mesh[o] = CL_X0 + dx * i
      mesh[o + 1] = CL_Z0 + dz * j
      mesh[o + 2] = heights[j * CL_NX + i]
      mesh[o + 3] = ((at(i + 1, j) - at(i - 1, j)) * toY) / (2 * dx)
      mesh[o + 4] = ((at(i, j + 1) - at(i, j - 1)) * toY) / (2 * dz)
    }
  }
  const count = (CL_NX - 1) * (CL_NZ - 1) * 6
  const index = CL_NX * CL_NZ > 65535 ? new Uint32Array(count) : new Uint16Array(count)
  let k = 0
  for (let j = 0; j < CL_NZ - 1; j++) {
    for (let i = 0; i < CL_NX - 1; i++) {
      const a = j * CL_NX + i
      index[k++] = a
      index[k++] = a + CL_NX
      index[k++] = a + 1
      index[k++] = a + 1
      index[k++] = a + CL_NX
      index[k++] = a + CL_NX + 1
    }
  }
  return { heights, mesh, index, count }
}

function clHeightAt(t: ClTerrain, x: number, z: number) {
  const fi = ((x - CL_X0) / (CL_X1 - CL_X0)) * (CL_NX - 1)
  const fj = ((z - CL_Z0) / (CL_Z1 - CL_Z0)) * (CL_NZ - 1)
  const i = Math.min(CL_NX - 2, Math.max(0, Math.floor(fi)))
  const j = Math.min(CL_NZ - 2, Math.max(0, Math.floor(fj)))
  const u = Math.min(1, Math.max(0, fi - i))
  const v = Math.min(1, Math.max(0, fj - j))
  const h = t.heights
  const a = h[j * CL_NX + i]
  const b = h[j * CL_NX + i + 1]
  const c = h[(j + 1) * CL_NX + i]
  const d = h[(j + 1) * CL_NX + i + 1]
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

/** route polyline draped on the terrain; len[] is normalised arc length 0→1 */
type ClRoute = { pts: [number, number, number][]; len: number[] }

function clRoute(t: ClTerrain): ClRoute {
  const P = CL_ROUTE_PTS
  const pts: [number, number, number][] = []
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)]
    const p1 = P[i]
    const p2 = P[i + 1]
    const p3 = P[Math.min(P.length - 1, i + 2)]
    for (let k = 0; k < 16; k++) {
      const u = k / 16
      const u2 = u * u
      const u3 = u2 * u
      const cr = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3)
      const x = cr(p0[0], p1[0], p2[0], p3[0])
      const z = cr(p0[1], p1[1], p2[1], p3[1])
      const m = p1[2] + (p2[2] - p1[2]) * u
      pts.push([x, z, Math.max(m, clHeightAt(t, x, z))])
    }
  }
  pts.push([P[P.length - 1][0], P[P.length - 1][1], CL_SUMMIT_M])
  // parameterise by on-screen length at the final card pose, so 78% of the
  // goal reads as 78% of the visible climb (the steep summit push is
  // foreshortened, and 3D arc length would overstate it)
  const { mvp } = clView(1, 0, CL_ASPECT)
  const scr = pts.map(([x, z, m]) => {
    const y = ((m - CL_FLOOR_M) / CL_SUMMIT_M) * CL_VSCALE
    const cx = mvp[0] * x + mvp[4] * y + mvp[8] * z + mvp[12]
    const cy = mvp[1] * x + mvp[5] * y + mvp[9] * z + mvp[13]
    const cw = mvp[3] * x + mvp[7] * y + mvp[11] * z + mvp[15]
    return [(cx / cw) * CL_ASPECT, cy / cw]
  })
  const len = [0]
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(scr[i][0] - scr[i - 1][0], scr[i][1] - scr[i - 1][1]))
  const total = len[len.length - 1]
  for (let i = 0; i < len.length; i++) len[i] /= total
  len[len.length - 1] = 1 // the summit is exactly 1, so progress 1 lands on it
  return { pts, len }
}

// generated once per page load; step updates never touch these
let clCache: { terrain: ClTerrain; route: ClRoute } | null = null
function clGeometry() {
  if (!clCache) {
    const terrain = clTerrain()
    clCache = { terrain, route: clRoute(terrain) }
  }
  return clCache
}

// ---------------------------------------------------------------------------
// GL

const CL_VERT = `attribute vec2 a_xz;
attribute float a_m;
attribute vec2 a_grad;
uniform mat4 u_mvp;
uniform float u_relief;
varying float v_m;
varying vec2 v_grad;
varying vec3 v_world;
void main() {
  vec3 p = vec3(a_xz.x, (a_m - ${CL_FLOOR_M.toFixed(1)}) / ${CL_SUMMIT_M.toFixed(1)} * ${CL_VSCALE.toFixed(3)} * u_relief, a_xz.y);
  v_m = a_m;
  v_grad = a_grad;
  v_world = p;
  gl_Position = u_mvp * vec4(p, 1.0);
}`

// FeralUI shading: navy → cobalt → desaturated blue → icy snow, luminous contours
const clFrag = (derivatives: boolean) => `${derivatives ? '#extension GL_OES_standard_derivatives : enable\n' : ''}precision highp float;
varying float v_m;
varying vec2 v_grad;
varying vec3 v_world;
uniform float u_relief;
uniform vec3 u_eye;
uniform vec3 u_haze;
float contour(float v) {
  ${derivatives ? 'float w = fwidth(v);' : 'float w = 0.04;'}
  return (1.0 - smoothstep(0.0, w, abs(fract(v - 0.5) - 0.5))) * (1.0 - smoothstep(0.22, 0.45, w));
}
void main() {
  vec3 n = normalize(vec3(-v_grad.x * u_relief, 1.0, -v_grad.y * u_relief));
  float lit = clamp(dot(n, normalize(vec3(-0.62, 0.66, 0.42))), 0.0, 1.0);
  float fill = clamp(dot(n, normalize(vec3(0.5, 0.6, -0.3))), 0.0, 1.0);
  float t = clamp((v_m - 2400.0) / 6449.0, 0.0, 1.0);
  vec3 col = mix(vec3(0.06, 0.12, 0.22), vec3(0.14, 0.24, 0.37), smoothstep(0.0, 0.34, t));
  col = mix(col, vec3(0.3, 0.39, 0.52), smoothstep(0.3, 0.56, t));
  float snow = smoothstep(0.54, 0.62, t + (n.y - 0.75) * 0.25) * smoothstep(0.4, 0.7, n.y);
  col = mix(col, vec3(0.9, 0.94, 1.0), snow);
  col *= 0.2 + 1.05 * lit + 0.12 * fill;
  float minor = contour(v_m / 250.0);
  float index = contour(v_m / 1000.0);
  col = mix(col, vec3(0.86, 0.93, 1.0), minor * 0.22 + index * 0.5);
  float edge = smoothstep(0.0, 0.35, 1.3 - abs(v_world.x)) * smoothstep(0.0, 0.3, v_world.z + 1.28) * smoothstep(0.0, 0.3, 1.38 - v_world.z);
  float haze = smoothstep(5.2, 7.6, distance(v_world, u_eye));
  gl_FragColor = vec4(mix(u_haze, col, edge * (1.0 - haze)), 1.0);
}`

type ClGl = { gl: WebGLRenderingContext; mvp: WebGLUniformLocation | null; relief: WebGLUniformLocation | null; eye: WebGLUniformLocation | null; haze: WebGLUniformLocation | null; count: number; wide: boolean }

function clGlSetup(canvas: HTMLCanvasElement, terrain: ClTerrain): ClGl | null {
  const gl = (canvas.getContext('webgl', { antialias: true, alpha: false }) || canvas.getContext('experimental-webgl', { antialias: true, alpha: false })) as WebGLRenderingContext | null
  if (!gl || gl.isContextLost()) return null
  const derivatives = !!gl.getExtension('OES_standard_derivatives')
  const wide = terrain.index instanceof Uint32Array
  if (wide && !gl.getExtension('OES_element_index_uint')) return null
  const sh = (type: number, src: string) => {
    const sd = gl.createShader(type)
    if (!sd) return null
    gl.shaderSource(sd, src)
    gl.compileShader(sd)
    if (!gl.getShaderParameter(sd, gl.COMPILE_STATUS)) {
      console.warn('[everest] shader:', gl.getShaderInfoLog(sd))
      return null
    }
    return sd
  }
  const vs = sh(gl.VERTEX_SHADER, CL_VERT)
  const fs = sh(gl.FRAGMENT_SHADER, clFrag(derivatives))
  const prog = gl.createProgram()
  if (!vs || !fs || !prog) return null
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null
  gl.useProgram(prog)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, terrain.mesh, gl.STATIC_DRAW)
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, terrain.index, gl.STATIC_DRAW)
  const attr = (name: string, size: number, offset: number) => {
    const loc = gl.getAttribLocation(prog, name)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 20, offset)
  }
  attr('a_xz', 2, 0)
  attr('a_m', 1, 8)
  attr('a_grad', 2, 12)
  gl.enable(gl.DEPTH_TEST)
  return {
    gl,
    mvp: gl.getUniformLocation(prog, 'u_mvp'),
    relief: gl.getUniformLocation(prog, 'u_relief'),
    eye: gl.getUniformLocation(prog, 'u_eye'),
    haze: gl.getUniformLocation(prog, 'u_haze'),
    count: terrain.count,
    wide,
  }
}

type ClMat = Float32Array

function clPerspective(fovy: number, aspect: number, near: number, far: number): ClMat {
  const f = 1 / Math.tan(fovy / 2)
  const m = new Float32Array(16)
  m[0] = -f / aspect
  m[5] = f
  m[10] = (far + near) / (near - far)
  m[11] = -1
  m[14] = (2 * far * near) / (near - far)
  return m
}

function clLookAt(eye: number[], at: number[]): ClMat {
  const zx = eye[0] - at[0]
  const zy = eye[1] - at[1]
  const zz = eye[2] - at[2]
  const zl = Math.hypot(zx, zy, zz)
  const f = [zx / zl, zy / zl, zz / zl]
  let sv = [f[2], 0, -f[0]]
  const sl = Math.hypot(sv[0], sv[1], sv[2]) || 1
  sv = [sv[0] / sl, sv[1] / sl, sv[2] / sl]
  const u = [f[1] * sv[2] - f[2] * sv[1], f[2] * sv[0] - f[0] * sv[2], f[0] * sv[1] - f[1] * sv[0]]
  const m = new Float32Array(16)
  m[0] = sv[0]
  m[4] = sv[1]
  m[8] = sv[2]
  m[1] = u[0]
  m[5] = u[1]
  m[9] = u[2]
  m[2] = f[0]
  m[6] = f[1]
  m[10] = f[2]
  m[12] = -(sv[0] * eye[0] + sv[1] * eye[1] + sv[2] * eye[2])
  m[13] = -(u[0] * eye[0] + u[1] * eye[1] + u[2] * eye[2])
  m[14] = -(f[0] * eye[0] + f[1] * eye[1] + f[2] * eye[2])
  m[15] = 1
  return m
}

function clMul(a: ClMat, b: ClMat): ClMat {
  const m = new Float32Array(16)
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) m[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]
  return m
}

/**
 * Final camera. The Feral scene was a tall portrait; the card is 3:2, so the
 * camera yaws ~50° and the route runs corner to corner — base low-right,
 * summit high-left — at close to the original scale. This side keeps the
 * original key light on the faces toward the camera.
 */
const CL_CAM = { pitch: 28, dist: 2.6, yaw: -0.85, target: [-0.08, 0.34, -0.27], fov: 32 }
/** the card's aspect; also the pose the route is parameterised in */
const CL_ASPECT = 3 / 2

/** camera at intro progress k (0 = top-down, 1 = final), with optional yaw drift */
function clView(k: number, drift: number, aspect: number) {
  const pitch = ((86 + (CL_CAM.pitch - 86) * k) * Math.PI) / 180
  const yaw = -0.12 + (CL_CAM.yaw + 0.12) * k + drift
  const dist = 4.8 + (CL_CAM.dist - 4.8) * k
  const target = [0.02 + (CL_CAM.target[0] - 0.02) * k, CL_CAM.target[1] * k, -0.22 + (CL_CAM.target[2] + 0.22) * k]
  const eye = [target[0] + Math.sin(yaw) * Math.cos(pitch) * dist, target[1] + Math.sin(pitch) * dist, target[2] - Math.cos(yaw) * Math.cos(pitch) * dist]
  const mvp = clMul(clPerspective((CL_CAM.fov * Math.PI) / 180, aspect, 0.05, 20), clLookAt(eye, target))
  return { eye, mvp }
}

/** intro timeline (s): camera tilt, route draw-in, pins */
const CL_T = { tilt: 1.9, draw: 1.45, drawDur: 1.9, pin: 3.35 }

const clEase = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

const clDrawEase = (t: number) => 1 - Math.pow(1 - t, 3)

// ---------------------------------------------------------------------------

export function EverestClimb({ steps, goalSteps = 53000, className }: EverestClimbProps) {
  const rawProgress = goalSteps > 0 ? steps / goalSteps : 0
  const progress = Math.min(1, Math.max(0, Number.isFinite(rawProgress) ? rawProgress : 0))

  const reduce = !!useReducedMotion()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const glRef = useRef<HTMLCanvasElement | null>(null)
  const lineRef = useRef<HTMLCanvasElement | null>(null)
  const headRef = useRef<HTMLDivElement | null>(null)
  const summitRef = useRef<HTMLDivElement | null>(null)
  /** route fraction the head is currently shown at (tweened toward targetRef) */
  const baseRef = useRef(progress)
  const targetRef = useRef(progress)
  /** time of the last live step update; the head glow flares briefly so even
   *  a few steps (a fraction of a pixel of route) read as movement */
  const bumpRef = useRef(0)
  /** paints a single frame; used when no rAF loop is running (reduced motion) */
  const redrawRef = useRef<(() => void) | null>(null)
  const altRef = useRef<HTMLSpanElement | null>(null)
  const [noGl, setNoGl] = useState(false)

  // live updates: glide only the route head, never rebuild the scene
  useEffect(() => {
    targetRef.current = progress
    const from = baseRef.current
    if (from === progress) return
    if (reduce) {
      baseRef.current = progress
      redrawRef.current?.()
      return
    }
    bumpRef.current = performance.now()
    const c = animate(from, progress, {
      duration: LIVE_TWEEN_S,
      ease: SOFT_EASE,
      onUpdate: (v) => {
        baseRef.current = v
      },
      onComplete: () => {
        baseRef.current = progress
      },
    })
    return () => c.stop()
  }, [progress, reduce])

  useEffect(() => {
    const root = rootRef.current
    const glCanvas = glRef.current
    const lineCanvas = lineRef.current
    if (!root || !glCanvas || !lineCanvas) return
    const { terrain, route } = clGeometry()
    let g = clGlSetup(glCanvas, terrain)
    // deferred so a missing context doesn't set state synchronously in the effect
    if (!g) queueMicrotask(() => setNoGl(true))

    const onLost = (e: Event) => {
      e.preventDefault()
      g = null
      setNoGl(true)
    }
    const onRestored = () => {
      g = clGlSetup(glCanvas, terrain)
      if (g) setNoGl(false)
      redrawRef.current?.()
    }
    glCanvas.addEventListener('webglcontextlost', onLost)
    glCanvas.addEventListener('webglcontextrestored', onRestored)
    const ctx = lineCanvas.getContext('2d')
    let raf = 0
    let visible = true
    let dpr = 1
    let w = 1
    let h = 1
    let t0 = 0
    const toY = (m: number, relief: number) => ((m - CL_FLOOR_M) / CL_SUMMIT_M) * CL_VSCALE * relief

    const draw = (now: number) => {
      if (!t0) t0 = now
      const t = reduce ? 99 : (now - t0) / 1000
      const k = clEase(Math.min(1, t / CL_T.tilt))
      const relief = 0.05 + 0.95 * k
      const drift = reduce ? 0 : Math.sin(Math.max(0, t - CL_T.tilt) * 0.12) * 0.16 * Math.min(1, Math.max(0, t - CL_T.tilt) / 3)

      // the original top-down → tilt intro, easing into the card framing
      const { eye, mvp } = clView(k, drift, w / h)
      if (g && !g.gl.isContextLost()) {
        const gl = g.gl
        gl.viewport(0, 0, glCanvas.width, glCanvas.height)
        gl.clearColor(HAZE[0], HAZE[1], HAZE[2], 1)
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
        gl.uniformMatrix4fv(g.mvp, false, mvp)
        gl.uniform1f(g.relief, relief)
        gl.uniform3f(g.eye, eye[0], eye[1], eye[2])
        gl.uniform3f(g.haze, HAZE[0], HAZE[1], HAZE[2])
        gl.drawElements(gl.TRIANGLES, g.count, g.wide ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0)
      }

      const proj2 = (x: number, y: number, z: number) => {
        const cx = mvp[0] * x + mvp[4] * y + mvp[8] * z + mvp[12]
        const cy = mvp[1] * x + mvp[5] * y + mvp[9] * z + mvp[13]
        const cw = mvp[3] * x + mvp[7] * y + mvp[11] * z + mvp[15]
        return [((cx / cw) * 0.5 + 0.5) * w, (0.5 - (cy / cw) * 0.5) * h, cw]
      }
      const lift = 0.006
      const scr = route.pts.map(([x, z, m]) => proj2(x, toY(m, relief) + lift, z))

      const hidden = route.pts.map(([x, z, m]) => {
        const py = toY(m, relief) + lift
        for (let st = 1; st < 24; st++) {
          const f = st / 24
          const sx = x + (eye[0] - x) * f
          const sz = z + (eye[2] - z) * f
          const sy = py + (eye[1] - py) * f
          if (toY(clHeightAt(terrain, sx, sz), relief) > sy + 0.004) return true
        }
        return false
      })

      // screen position of a route fraction
      const at = (frac: number): [number, number] => {
        for (let i = 1; i < scr.length; i++) {
          if (route.len[i] >= frac) {
            const f = (frac - route.len[i - 1]) / Math.max(1e-6, route.len[i] - route.len[i - 1])
            return [scr[i - 1][0] + (scr[i][0] - scr[i - 1][0]) * f, scr[i - 1][1] + (scr[i][1] - scr[i - 1][1]) * f]
          }
        }
        const last = scr[scr.length - 1]
        return [last[0], last[1]]
      }

      const drawn = reduce ? 1 : clDrawEase(Math.min(1, Math.max(0, (t - CL_T.draw) / CL_T.drawDur)))
      const base = baseRef.current
      const head = base * drawn
      const alt = altRef.current
      if (alt) alt.textContent = `${Math.round(head * CL_SUMMIT_M).toLocaleString('en-US')} m`
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, w, h)
        ctx.lineCap = 'round'
        const width = (cw: number) => Math.max(0.6, Math.min(1.6, 2.2 / cw))

        // remaining route, dotted
        const reveal = reduce ? 1 : Math.min(1, Math.max(0, (t - CL_T.draw - 0.3) / 1.2))
        if (reveal > 0) {
          for (let i = 1; i < scr.length; i += 2) {
            if (route.len[i] <= head) continue
            const [x, y, cw] = scr[i]
            ctx.fillStyle = `rgba(255, 214, 170, ${(hidden[i] ? 0.16 : 0.55) * reveal})`
            ctx.beginPath()
            ctx.arc(x, y, 1.3 * width(cw), 0, Math.PI * 2)
            ctx.fill()
          }
        }

        // completed route: stacked glow passes
        ctx.globalCompositeOperation = 'lighter'
        const pulse = reduce || t < CL_T.pin + 0.6 ? -1 : ((t - CL_T.pin - 0.6) % 3.6) / 2.4
        const passes: [number, string, number][] = [
          [9, '255, 120, 60', 0.09],
          [4.6, '255, 150, 80', 0.32],
          [2.2, '255, 196, 140', 0.9],
          [0.9, '255, 246, 228', 0.95],
        ]
        for (const [lw, rgb, a] of passes) {
          for (let i = 1; i < scr.length; i++) {
            if (route.len[i - 1] >= head) break
            const sl = route.len[i]
            const trail = 0.45 + 0.55 * clSmooth(head - 0.2, head, sl)
            const flow = pulse >= 0 && pulse <= 1 ? Math.exp(-Math.pow((sl / Math.max(0.001, head) - pulse) * 9, 2)) * 0.6 : 0
            const shade = hidden[i] ? 0.22 : 1
            const [x0, y0, cw] = scr[i - 1]
            let [x1, y1] = scr[i]
            if (sl > head) {
              const f = (head - route.len[i - 1]) / Math.max(1e-6, sl - route.len[i - 1])
              x1 = x0 + (x1 - x0) * f
              y1 = y0 + (y1 - y0) * f
            }
            ctx.strokeStyle = `rgba(${rgb}, ${Math.min(1, a * (trail + flow) * shade)})`
            ctx.lineWidth = lw * width(cw)
            ctx.beginPath()
            ctx.moveTo(x0, y0)
            ctx.lineTo(x1, y1)
            ctx.stroke()
          }
        }

        const [hx, hy] = at(head)
        if (drawn > 0) {
          const moving = drawn < 1 || Math.abs(base - targetRef.current) > 1e-4 ? 1 : 0.55
          const flare = bumpRef.current ? Math.max(0, 1 - (now - bumpRef.current) / 900) : 0
          const glow = moving + 0.6 * flare * flare
          const br = 18 + 10 * flare
          const bloom = ctx.createRadialGradient(hx, hy, 0, hx, hy, br)
          bloom.addColorStop(0, `rgba(255, 190, 120, ${Math.min(1, 0.55 * glow)})`)
          bloom.addColorStop(0.4, `rgba(255, 130, 60, ${0.18 * glow})`)
          bloom.addColorStop(1, 'rgba(255, 110, 50, 0)')
          ctx.fillStyle = bloom
          ctx.beginPath()
          ctx.arc(hx, hy, br, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalCompositeOperation = 'source-over'

        // pins follow their anchors; each is nudged sideways to stay inside
        // the card, and "You're here" drops below its dot when it would
        // collide with the Everest pin or run off the top
        const [sx, sy] = scr[scr.length - 1]
        const sum = summitRef.current
        const hd = headRef.current
        // measure both pills before writing any styles: one layout per frame
        const halfW = (el: HTMLDivElement | null) => ((el?.firstElementChild as HTMLElement | null)?.offsetWidth ?? 0) / 2
        const sumHalf = halfW(sum)
        const hdHalf = halfW(hd)
        const place = (el: HTMLDivElement | null, x: number, y: number, half: number) => {
          if (!el) return
          el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
          const shift = Math.min(0, w - 6 - (x + half)) + Math.max(0, 6 - (x - half))
          el.style.setProperty('--shift', `${shift.toFixed(1)}px`)
        }
        place(sum, sx, sy, sumHalf)
        place(hd, hx, hy, hdHalf)
        if (hd) {
          const below = hy < 44 || (Math.abs(hy - sy) < 40 && Math.abs(hx - sx) < 150)
          if ((hd.dataset.below === '1') !== below) hd.dataset.below = below ? '1' : ''
        }
      }
      raf = !reduce && visible ? requestAnimationFrame(draw) : 0
    }

    const fit = () => {
      dpr = Math.min(2, Math.max(1.5, window.devicePixelRatio || 1))
      w = root.clientWidth || 1
      h = root.clientHeight || 1
      for (const c of [glCanvas, lineCanvas]) {
        const cw = Math.round(w * dpr)
        const ch = Math.round(h * dpr)
        if (c.width !== cw || c.height !== ch) {
          c.width = cw
          c.height = ch
        }
      }
      if (reduce) draw(performance.now())
    }
    redrawRef.current = () => {
      if (reduce || !raf) draw(performance.now())
    }

    const ro = new ResizeObserver(fit)
    ro.observe(root)
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible && !reduce && !raf) raf = requestAnimationFrame(draw)
    })
    io.observe(root)
    fit()
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      raf = 0
      redrawRef.current = null
      ro.disconnect()
      io.disconnect()
      glCanvas.removeEventListener('webglcontextlost', onLost)
      glCanvas.removeEventListener('webglcontextrestored', onRestored)
      const glDone = g?.gl
      window.setTimeout(() => {
        if (!glCanvas.isConnected) glDone?.getExtension('WEBGL_lose_context')?.loseContext()
      }, 0)
    }
  }, [reduce])

  const pinIn = (delay: number) => ({
    initial: { opacity: 0, scale: 0.85 },
    animate: { opacity: 1, scale: 1 },
    transition: reduce ? { duration: 0 } : { delay, duration: 0.45, ease: [0.34, 1.4, 0.5, 1] as [number, number, number, number] },
  })

  return (
    <div ref={rootRef} className={`${s.root} ${noGl ? s.flat : ''} ${className ?? ''}`} aria-hidden="true">
      <canvas ref={glRef} className={s.layer} />
      <canvas ref={lineRef} className={s.layer} />
      <div ref={summitRef} className={s.anchor}>
        <motion.div className={`${s.pin} ${s.pinSummit}`} {...pinIn(CL_T.tilt - 0.3)}>
          <b>Everest</b>
          <span>8,849 m</span>
        </motion.div>
      </div>
      <div ref={headRef} className={s.anchor}>
        <motion.div className={`${s.pin} ${s.pinHere}`} {...pinIn(CL_T.pin)}>
          <b>You&rsquo;re here</b>
          <span ref={altRef} />
        </motion.div>
        <motion.i className={s.dot} {...pinIn(CL_T.pin - 0.1)} />
      </div>
    </div>
  )
}
