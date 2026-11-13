/*
 * Liquid glass reveal engine — ported from zanwei/glass-icon-reveal
 * (MIT, © 2026 Zanwei Guo; full notice in ./shaders.ts), the source behind
 * the 21st.dev "Liquid Glass Logo Reveal".
 *
 * Kept: the SDF logo field (exact Euclidean distance transform), the WebGL2
 * renderer and the spring-driven frameAt() timeline, verbatim in behaviour.
 * Peak changes: the logo is the (monochrome) Peak mark; the texture is 512² instead of
 * 1024² (the mark is never shown larger than ~120 px, and the EDT is 4×
 * cheaper on low-end phones); the "dark" look re-coloured to Peak petrol;
 * the editor UI, presets, storage and export are dropped.
 */
import { FRAG, VERT } from './shaders'

const TEX = 512
const BOX = 0.75

/* ── logo field ─────────────────────────────────────────────────────── */

export type LogoField = { canvas: HTMLCanvasElement; sdf: Float32Array }

/** Peak mark: the stair summit (matches PeakMark / favicon). */
const PEAK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="5 7 22 18" width="1024" height="838">' +
  '<path fill="#ffffff" d="M5 25V21.5h4V18h4v-3.5h3.2L19.5 7 27 25z"/></svg>'

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('logo image failed'))
    img.src = src
  })
}

/** Draw into a TEX×TEX canvas, cropped to visible pixels, fitted into the logo box. */
function fitToTexture(source: HTMLImageElement, sw: number, sh: number) {
  const tmp = document.createElement('canvas')
  tmp.width = tmp.height = TEX
  const tc = tmp.getContext('2d', { willReadFrequently: true })!
  const s0 = Math.min(TEX / sw, TEX / sh)
  const dx0 = (TEX - sw * s0) / 2
  const dy0 = (TEX - sh * s0) / 2
  tc.drawImage(source, dx0, dy0, sw * s0, sh * s0)
  const d = tc.getImageData(0, 0, TEX, TEX).data
  let x0 = TEX
  let y0 = TEX
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < TEX; y++) {
    for (let x = 0; x < TEX; x++) {
      if (d[(y * TEX + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  const bw = x1 - x0 + 1
  const bh = y1 - y0 + 1
  const s = (TEX * BOX) / Math.max(bw, bh)
  const out = document.createElement('canvas')
  out.width = out.height = TEX
  const oc = out.getContext('2d', { willReadFrequently: true })!
  oc.imageSmoothingQuality = 'high'
  const ox = TEX / 2 - (x0 + bw / 2 - dx0) * s
  const oy = TEX / 2 - (y0 + bh / 2 - dy0) * s
  oc.drawImage(source, ox, oy, sw * s0 * s, sh * s0 * s)
  return out
}

/** Signed distance from alpha (TinySDF method): + outside, − inside, texture units. */
function buildSdf(canvas: HTMLCanvasElement) {
  const n = TEX * TEX
  const alpha = canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, TEX, TEX).data
  const INF = 1e20
  const outer = new Float64Array(n)
  const inner = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const a = alpha[i * 4 + 3] / 255
    if (a >= 1) {
      outer[i] = 0
      inner[i] = INF
    } else if (a <= 0) {
      outer[i] = INF
      inner[i] = 0
    } else {
      const dd = 0.5 - a
      outer[i] = dd > 0 ? dd * dd : 0
      inner[i] = dd < 0 ? dd * dd : 0
    }
  }
  const f = new Float64Array(TEX)
  const z = new Float64Array(TEX + 1)
  const v = new Uint16Array(TEX)
  edt(outer, f, v, z, INF)
  edt(inner, f, v, z, INF)
  const sdf = new Float32Array(n)
  for (let i = 0; i < n; i++) sdf[i] = (Math.sqrt(outer[i]) - Math.sqrt(inner[i])) / TEX
  return sdf
}

function edt(grid: Float64Array, f: Float64Array, v: Uint16Array, z: Float64Array, INF: number) {
  for (let x = 0; x < TEX; x++) edt1d(grid, x, TEX, f, v, z, INF)
  for (let y = 0; y < TEX; y++) edt1d(grid, y * TEX, 1, f, v, z, INF)
}

function edt1d(grid: Float64Array, offset: number, stride: number, f: Float64Array, v: Uint16Array, z: Float64Array, INF: number) {
  v[0] = 0
  z[0] = -INF
  z[1] = INF
  f[0] = grid[offset]
  for (let q = 1, k = 0; q < TEX; q++) {
    f[q] = grid[offset + q * stride]
    const q2 = q * q
    let s: number
    do {
      const r = v[k]
      s = (f[q] - f[r] + q2 - r * r) / (q - r) / 2
    } while (s <= z[k] && --k > -1)
    k++
    v[k] = q
    z[k] = s
    z[k + 1] = INF
  }
  for (let q = 0, k = 0; q < TEX; q++) {
    while (z[k + 1] < q) k++
    const r = v[k]
    const qr = q - r
    grid[offset + q * stride] = f[r] + qr * qr
  }
}

let peakField: Promise<LogoField> | null = null
/** Built once per page load and shared (≈ tens of ms at 512²). */
export function peakLogoField(): Promise<LogoField> {
  peakField ??= loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(PEAK_SVG)).then((img) => {
    const canvas = fitToTexture(img, img.naturalWidth || 1024, img.naturalHeight || 838)
    return { canvas, sdf: buildSdf(canvas) }
  })
  return peakField
}

/* ── renderer ───────────────────────────────────────────────────────── */

const FRAME_KEYS = [
  'uPlateScale', 'uShapeN', 'uCornerN', 'uOptics', 'uPlateAlpha', 'uLogoHalf', 'uBold', 'uBlur', 'uFrost', 'uDome', 'uDrop', 'uPinch', 'uTilt', 'uBare',
  'uReach', 'uCornerPull', 'uStreak', 'uWiden', 'uSlab', 'uEtaSpread', 'uFocus', 'uFocusK', 'uFocusSplit', 'uRimLine', 'uCornerOn', 'uDissolve', 'uGlow', 'uFaceDisp', 'uVivid',
  'uRim', 'uHalo', 'uShadow', 'uGhost', 'uRipR', 'uRipA', 'uDepth', 'uDisp', 'uDouble', 'uBevelW', 'uSpec', 'uIconPlate',
  'uUseColor', 'uLightScene',
] as const

export type Frame = Record<(typeof FRAME_KEYS)[number], number> & {
  uBg: [number, number, number]
  uPlateCol: [number, number, number]
  uLogoCol: [number, number, number]
  uLogoOff: [number, number]
}

export type Renderer = {
  setLogo(logo: LogoField): void
  render(fr: Frame, w: number, h: number, tilePx: number): void
  dispose(): void
}

export function createRenderer(canvas: HTMLCanvasElement): Renderer | null {
  const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false })
  if (!gl) return null
  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type)!
    gl.shaderSource(sh, src)
    gl.compileShader(sh)
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? 'shader')
    return sh
  }
  const prog = gl.createProgram()!
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT))
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG))
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link')
  gl.useProgram(prog)

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(prog, 'aPos')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

  const U: Record<string, WebGLUniformLocation | null> = {}
  const count = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS) as number
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(prog, i)
    if (info) U[info.name] = gl.getUniformLocation(prog, info.name)
  }
  const sdfTex = gl.createTexture()
  const colTex = gl.createTexture()
  gl.uniform1i(U.uSdf, 0)
  gl.uniform1i(U.uCol, 1)
  let hasLogo = false

  return {
    setLogo(logo) {
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, sdfTex)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, TEX, TEX, 0, gl.RED, gl.FLOAT, logo.sdf)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, colTex)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, logo.canvas)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
      gl.generateMipmap(gl.TEXTURE_2D)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      hasLogo = true
    },
    render(fr, w, h, tilePx) {
      if (!hasLogo) return
      gl.viewport(0, 0, w, h)
      gl.uniform2f(U.uCenter, w / 2, h / 2)
      gl.uniform1f(U.uTile, tilePx)
      gl.uniform1f(U.uTexSize, TEX)
      gl.uniform1f(U.uBoxFrac, BOX)
      for (const k of FRAME_KEYS) if (U[k]) gl.uniform1f(U[k], fr[k])
      gl.uniform3fv(U.uBg, fr.uBg)
      gl.uniform3fv(U.uPlateCol, fr.uPlateCol)
      gl.uniform3fv(U.uLogoCol, fr.uLogoCol)
      gl.uniform2fv(U.uLogoOff, fr.uLogoOff)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    },
    dispose() {
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    },
  }
}

/* ── look + spring timeline (frameAt, verbatim behaviour) ───────────── */

export type Look = {
  logoScale: number
  finalScale: number
  iconPlate: boolean
  originalColors: boolean
  opticalDepth: number
  dispersion: number
  glow: number
  doubleBevel: number
  bevelWidth: number
  corner: number
  cornerPull: number
  cornerWidth: number
  cornerFocus: number
  edgeSmear: number
  stretch: number
  tilt: number
  bulge: number
  specular: number
  halo: number
  shadow: number
  ripple: number
  bounce: number
  response: number
  startSize: number
  startZoom: number
  present: number
  drift: number
  swell: number
  focus: number
  background: string
  plateColor: string
  logoColor: string
}

/** The source's "dark" look, in Peak monochrome (smoke plate, black backdrop). */
export const PEAK_LOOK: Look = {
  logoScale: 0.72,
  finalScale: 1,
  iconPlate: true,
  originalColors: true,
  opticalDepth: 0.75,
  dispersion: 0.9,
  glow: 0.45,
  doubleBevel: 1,
  bevelWidth: 0.22,
  corner: 5,
  cornerPull: 1.4,
  cornerWidth: 1.2,
  cornerFocus: 0.4,
  edgeSmear: 1.2,
  stretch: 0,
  tilt: 0,
  bulge: 1,
  specular: 1,
  halo: 1,
  shadow: 0,
  ripple: 0.5,
  bounce: 0,
  response: 0.34,
  startSize: 0.2,
  startZoom: 1.6,
  present: 1,
  drift: 0.05,
  swell: 0.5,
  focus: 1,
  background: '#0a0a0a',
  plateColor: '#161617',
  logoColor: '#ffffff',
}

const TAIL = 0.95
export const revealLength = (P: Look) => P.present + TAIL

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
const hexToRgb = (h: string): [number, number, number] => {
  const v = parseInt(h.slice(1), 16)
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255]
}
const luminance = ([r, g, b]: [number, number, number]) => 0.2126 * r + 0.7152 * g + 0.0722 * b

/** Step response of a spring (damping ratio, response = undamped period in s). */
function spring(t: number, response: number, damping: number) {
  if (t <= 0) return 0
  const w = (2 * Math.PI) / response
  if (damping >= 1) return 1 - Math.exp(-w * t) * (1 + w * t)
  const wd = w * Math.sqrt(1 - damping * damping)
  return 1 - Math.exp(-damping * w * t) * (Math.cos(wd * t) + ((damping * w) / wd) * Math.sin(wd * t))
}

const reachCache = new Map<string, number>()
function timeToReach(level: number, response: number, damping: number) {
  const key = level + '/' + response + '/' + damping
  if (!reachCache.has(key)) {
    let lo = 0
    let hi = 3
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2
      if (spring(mid, response, damping) < level) lo = mid
      else hi = mid
    }
    reachCache.set(key, hi)
  }
  return reachCache.get(key)!
}

/** All motion: time → shader uniforms. Every channel is one or two overlapping springs. */
export function frameAt(T: number, P: Look): Frame {
  const tx = P.present
  const damping = 1 - P.bounce
  const grow = spring(T + 0.01, P.response, damping)
  const tl = timeToReach(0.85, P.response, damping) - 0.01
  const tm = timeToReach(0.92, P.response, damping) - 0.01
  const morph = spring(T - tm, 0.3, 1)
  const drop = 1 - smooth(0.05, 1, morph)
  const appear = smooth(0, 0.06, T)
  const drift = P.drift * spring(T - 0.25, 1.5, 1)
  const zoomIn = spring(T, 0.7, 1)
  const settle = spring(T - 0.4, 1.6, 1)
  const exit = spring(T - tx, 0.8, 1)
  const release = spring(T - tx - 0.05, 0.5, 1)
  const dome = 0.15 * P.bulge * (1 - smooth(0.4, 0.95, grow))
  const view = (1 + (P.startZoom - 1) * (1 - zoomIn)) * (1 - 0.045 * settle) * mix(1, P.finalScale, exit)
  const bandW = mix(P.bevelWidth, Math.max(P.bevelWidth, 0.4), drop)
  const plateScale = mix(P.startSize, 1, grow) * (1 + drift) * (1 + 0.14 * release)
  const light = luminance(hexToRgb(P.background)) > 0.5 ? 1 : 0
  return {
    uPlateScale: plateScale,
    uShapeN: mix(2, P.corner, morph),
    uCornerN: P.corner,
    uOptics: 1 - smooth(0.55, 1, release),
    uPlateAlpha: appear * (1 - smooth(0.45, 1, release)),
    uLogoHalf: P.logoScale * view,
    uLogoOff: [0, 0],
    uBold: P.swell * 0.03 * (1 - zoomIn),
    uBlur: P.focus * 0.05 * (1 - smooth(0.3, 0.95, grow)),
    uFrost: P.focus * (1 - smooth(0.5, 0.95, grow)),
    uPinch: 0.38 * P.stretch * smooth(0.1, 0.9, morph) * smooth(0.75, 0.97, zoomIn),
    uTilt: P.tilt,
    uDome: dome,
    uDrop: drop,
    uRim: 1 + 0.8 * drop,
    uHalo: P.halo * (0.5 + 0.5 * drop),
    uShadow: P.shadow * smooth(0.45, 0.8, grow) * (1 - smooth(0, 0.6, morph)),
    uGhost: smooth(0, 0.03, T) * (1 - smooth(0.04, 0.08, T)),
    uRipR: 1 + 0.9 * Math.max(0, T - tl),
    uRipA: P.ripple * smooth(tl, tl + 0.06, T) * Math.exp(-Math.max(0, T - tl) / 0.5),
    uBare: smooth(tx - 0.2, tx, T),
    uReach: bandW * plateScale,
    uCornerPull: P.cornerPull,
    uStreak: P.edgeSmear,
    uWiden: P.cornerWidth,
    uSlab: 0.3 * P.opticalDepth,
    uEtaSpread: 0.06,
    uFocus: P.cornerFocus,
    uFocusK: 1.0,
    uFocusSplit: 0.056 * P.glow,
    uRimLine: 0.09,
    uCornerOn: smooth(0.35, 1, morph),
    uGlow: 0.012 * P.glow,
    uFaceDisp: 0.012 * P.dispersion,
    uVivid: 0.85,
    uDissolve: release,
    uDepth: P.opticalDepth,
    uDisp: P.dispersion,
    uDouble: P.doubleBevel,
    uBevelW: bandW * (1 - release),
    uSpec: P.specular,
    uIconPlate: P.iconPlate ? 1 : 0,
    uUseColor: P.originalColors ? 1 : 0,
    uLightScene: light,
    uBg: hexToRgb(P.background),
    uPlateCol: hexToRgb(P.plateColor),
    uLogoCol: hexToRgb(P.logoColor),
  }
}
