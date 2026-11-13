import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'
import s from './peakGlassField.module.css'

/**
 * Peak glass field: the atmospheric layer behind hero moments (auth first).
 *
 * Adapted from the FeralUI "Glass ramune" pixel/glass renderer: same tile
 * construction (gap, corner radius, drop shadow, 128° tint, gloss, top
 * sheen, specular dot, inner shade, bevelled edge, veiled top rows, ragged
 * dropout, horizon glow) re-lit in Peak's smoked teal / petrol / celadon.
 *
 * Cost model, tuned for low-end Android:
 * - glass tiles are painted once per size on a static canvas (DPR ≤ 1.5);
 * - only the light field animates, on a small low-res canvas (~24 fps)
 *   that the browser upscales — the light visibly moves *through* the
 *   translucent panes, which replaces the original per-frame refraction;
 * - the loop stops when the tab is hidden, the field is off-screen, or the
 *   user prefers reduced motion (then a single still frame is drawn).
 */

type Rgb = readonly [number, number, number]

// palette sampled from the approved target (peak-glass-target.png)
const SKY_TOP: Rgb = [64, 98, 122]
const SKY_MID: Rgb = [62, 112, 134]
const TEAL: Rgb = [16, 108, 122]
const PETROL: Rgb = [4, 78, 108]
const ABYSS: Rgb = [3, 46, 86]
const CELADON: Rgb = [38, 204, 168]
const GLOW: Rgb = [112, 214, 204]
const EMERALD: Rgb = [40, 210, 156]
const DEEP: Rgb = [2, 40, 74]

const GAP = 0.03 // Glass ramune uses 0.016; the target reads slightly airier
const RADIUS = 0.19
const FPS = 24
const MAX_DPR = 1.5

const rgba = ([r, g, b]: Rgb, a: number) => `rgba(${r},${g},${b},${a})`
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smooth = (v: number) => {
  const t = clamp01(v)
  return t * t * (3 - 2 * t)
}
/** Glass ramune's hash (Be) so dropouts stay stable across renders */
const hash = (a: number, b: number) => {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return n - Math.floor(n)
}

type Tile = { x: number; y: number; size: number; depth: number; veil: number }
type Layout = {
  w: number
  h: number
  cell: number
  landscape: boolean
  /** y (css px) where the glass stack begins */
  horizon: number
  /** content window (landscape): centred valley in the stack, as x fractions */
  valley: [number, number] | null
  tiles: Tile[]
}

function computeLayout(w: number, h: number): Layout {
  const landscape = w > h * 1.05
  // Glass ramune: cell = min(w,h) / 9, grid from the top-left
  const cell = Math.max(40, Math.min(132, Math.min(w, h) / (landscape ? 9 : 7.2)))
  const cols = Math.ceil(w / cell)
  const rows = Math.ceil(h / cell)
  // crest row: Glass ramune floor(rows·0.78·(1 − cover 55%)); lower on phones
  const crest = Math.floor(rows * (landscape ? 0.78 * 0.45 : 0.47))
  const horizon = crest * cell
  const valley: [number, number] | null = landscape ? [0.3, 0.7] : null
  const tiles: Tile[] = []
  for (let c = 0; c < cols; c++) {
    const a = (c + 0.5) / cols
    // Glass ramune Zl steps a text window into the crest; Peak centres it
    // (two rows deep, one-row shoulders) so centred content sits inside
    let start = crest
    if (landscape) start += a < 0.3 ? 0 : a < 0.38 ? 1 : a < 0.62 ? 2 : a < 0.7 ? 1 : 0
    else if (hash(c * 3 + 1, 17) > 0.6) start += 1
    const span = Math.max(1, rows - start - 1)
    for (let r = start; r < rows; r++) {
      const m = (r - start) / span
      // ragged crest: random dropouts that fade out with depth (Ol 0.28, Gl 3.5)
      if (hash(r * 5 + 11, c * 13 + 7) < 0.28 * Math.pow(1 - m, 3.5)) continue
      const size = cell * (1 - GAP)
      tiles.push({
        x: c * cell + (cell - size) / 2,
        y: r * cell + (cell - size) / 2,
        size,
        depth: m,
        veil: 0.5 * smooth(1 - (r - start) / 2.6),
      })
    }
  }
  return { w, h, cell, landscape, horizon, valley, tiles }
}

function roundRect(ctx: CanvasRenderingContext2D, w: number, h: number, r: number) {
  const k = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(k, 0)
  ctx.arcTo(w, 0, w, h, k)
  ctx.arcTo(w, h, 0, h, k)
  ctx.arcTo(0, h, 0, 0, k)
  ctx.arcTo(0, 0, w, 0, k)
  ctx.closePath()
}

/* ── static glass layer ─────────────────────────────────────────────── */

let shadowCanvas: HTMLCanvasElement | null = null

function paintGlass(canvas: HTMLCanvasElement, L: Layout, dpr: number) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // 1 · soft drop shadows, blurred once as a layer (Glass ramune: Dl / Tl)
  shadowCanvas ??= document.createElement('canvas')
  const sc = shadowCanvas
  sc.width = canvas.width
  sc.height = canvas.height
  const sx = sc.getContext('2d')
  if (sx) {
    sx.setTransform(dpr, 0, 0, dpr, 0, 0)
    sx.clearRect(0, 0, L.w, L.h)
    sx.fillStyle = rgba(DEEP, 1)
    for (const t of L.tiles) {
      sx.save()
      sx.translate(t.x, t.y + t.size * 0.05)
      roundRect(sx, t.size, t.size, t.size * RADIUS)
      sx.globalAlpha = 0.06 + 0.1 * t.depth // light leaks through the gaps; shadows stay faint
      sx.fill()
      sx.restore()
    }
    const blur = 2 * L.cell * 0.075 * dpr
    // ctx.filter is missing on older Safari: fall back to an unblurred, lighter shadow
    const supportsFilter = typeof (ctx as { filter?: unknown }).filter === 'string'
    if (supportsFilter) ctx.filter = `blur(${blur.toFixed(1)}px)`
    else ctx.globalAlpha = 0.6
    ctx.drawImage(sc, 0, 0)
    ctx.filter = 'none'
    ctx.globalAlpha = 1
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const ang = (128.1 * Math.PI) / 180 // Glass ramune Wl
  const vx = Math.sin(ang)
  const vy = -Math.cos(ang)

  for (const t of L.tiles) {
    const z = t.size
    const lift = 1 - 0.6 * t.depth // whites fade with depth so lower glass stays saturated
    const half = (Math.abs(vx) * z + Math.abs(vy) * z) / 2
    ctx.save()
    ctx.translate(t.x, t.y)

    // body: thin at the crest so the aurora shows through, dense petrol below
    roundRect(ctx, z, z, z * RADIUS)
    ctx.fillStyle = rgba(DEEP, 0.02 + 0.42 * Math.pow(t.depth, 1.6))
    ctx.fill()

    // veil on the upper rows (Glass ramune mixes toward white by `veil`)
    if (t.veil > 0.01) {
      const v = ctx.createLinearGradient(0, 0, 0, z)
      v.addColorStop(0, `rgba(190,245,235,${0.1 * t.veil})`)
      v.addColorStop(1, `rgba(190,245,235,${0.02 * t.veil})`)
      ctx.fillStyle = v
      ctx.fill()
    }

    // 128° tint: cool light at top-left, petrol at bottom-right
    const tint = ctx.createLinearGradient(z / 2 - vx * half, z / 2 - vy * half, z / 2 + vx * half, z / 2 + vy * half)
    // light end only: a long dark low-alpha ramp bands visibly at 8 bits
    tint.addColorStop(0, `rgba(200,250,240,${0.07 * lift})`)
    tint.addColorStop(0.45, 'rgba(200,250,240,0)')
    ctx.fillStyle = tint
    ctx.fill()

    // gloss (N) and inner shade (I)
    const gloss = ctx.createRadialGradient(z * 0.3, z * 0.24, 0, z * 0.3, z * 0.24, z * 0.85)
    gloss.addColorStop(0, `rgba(255,255,255,${0.16 * lift})`)
    gloss.addColorStop(0.55, `rgba(255,255,255,${0.02 * lift})`)
    gloss.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gloss
    ctx.fill()
    const shade = ctx.createRadialGradient(z * 0.72, z * 0.86, 0, z * 0.72, z * 0.86, z * 0.9)
    shade.addColorStop(0, rgba(DEEP, 0.26))
    shade.addColorStop(0.6, rgba(DEEP, 0.07))
    shade.addColorStop(1, rgba(DEEP, 0))
    ctx.fillStyle = shade
    ctx.fill()

    // lens: a convex pane darkens toward its rim
    const lens = ctx.createRadialGradient(z * 0.46, z * 0.42, z * 0.18, z * 0.5, z * 0.5, z * 0.78)
    lens.addColorStop(0, 'rgba(0,0,0,0)')
    lens.addColorStop(1, rgba(DEEP, 0.2 + 0.1 * t.depth))
    ctx.fillStyle = lens
    ctx.fill()

    // top sheen (P)
    const sheen = ctx.createLinearGradient(0, 0, 0, z)
    sheen.addColorStop(0, `rgba(255,255,255,${0.2 * lift})`)
    sheen.addColorStop(0.16, `rgba(255,255,255,${0.05 * lift})`)
    sheen.addColorStop(0.48, 'rgba(255,255,255,0)')
    ctx.fillStyle = sheen
    ctx.fill()

    // specular dot (T) near the upper-left corner
    const dot = ctx.createRadialGradient(z * 0.2, z * 0.15, 0, z * 0.2, z * 0.15, z * 0.12)
    dot.addColorStop(0, 'rgba(255,255,255,0.8)')
    dot.addColorStop(0.28, 'rgba(235,255,252,0.32)')
    dot.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = dot
    ctx.fill()

    // bevelled edge: bright top-left, petrol bottom-right
    const edge = ctx.createLinearGradient(0, 0, z, z)
    edge.addColorStop(0, 'rgba(255,255,255,0.42)')
    edge.addColorStop(0.42, 'rgba(255,255,255,0.12)')
    edge.addColorStop(0.72, rgba(DEEP, 0.12))
    edge.addColorStop(1, rgba(DEEP, 0.3))
    ctx.strokeStyle = edge
    ctx.lineWidth = Math.max(1, z * 0.018)
    roundRect(ctx, z, z, z * RADIUS)
    ctx.stroke()
    ctx.restore()
  }

  // horizon glow along the crest (Glass ramune zl band)
  const top = L.horizon - L.cell * 1.4
  const bottom = L.horizon + L.cell * 1.3
  const band = ctx.createLinearGradient(0, top, 0, bottom)
  band.addColorStop(0, 'rgba(160,240,226,0)')
  band.addColorStop(0.45, 'rgba(160,240,226,0.1)')
  band.addColorStop(0.7, 'rgba(160,240,226,0.04)')
  band.addColorStop(1, 'rgba(160,240,226,0)')
  ctx.fillStyle = band
  ctx.fillRect(0, Math.max(0, top), L.w, bottom - Math.max(0, top))
}

/* ── animated light field (low-res) ─────────────────────────────────── */

function softDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c: Rgb, a: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, rgba(c, a))
  g.addColorStop(0.5, rgba(c, a * 0.45))
  g.addColorStop(1, rgba(c, 0))
  ctx.fillStyle = g
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
}

const canFilter = (ctx: CanvasRenderingContext2D) => typeof (ctx as { filter?: unknown }).filter === 'string'

/**
 * An aurora ribbon: one cubic stroke in fractional coords, faded at both
 * ends, blurred on the (small) light canvas. Falls back to a shadow blur
 * where ctx.filter is unsupported.
 */
function ribbon(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  pts: [number, number][],
  width: number,
  c: Rgb,
  a: number,
) {
  const S = Math.max(W, H)
  const [p0, p1, p2, p3] = pts.map(([x, y]) => [x * W, y * H] as const)
  const fade = ctx.createLinearGradient(p0[0], p0[1], p3[0], p3[1])
  fade.addColorStop(0, rgba(c, 0))
  fade.addColorStop(0.28, rgba(c, a))
  fade.addColorStop(0.72, rgba(c, a))
  fade.addColorStop(1, rgba(c, 0))
  const blur = width * S * 0.45
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineWidth = width * S
  if (canFilter(ctx)) {
    ctx.filter = `blur(${blur.toFixed(1)}px)`
    ctx.strokeStyle = fade
    ctx.beginPath()
    ctx.moveTo(p0[0], p0[1])
    ctx.bezierCurveTo(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1])
    ctx.stroke()
  } else {
    // draw off-canvas and let only the blurred shadow land in place
    const off = W * 4
    ctx.shadowColor = rgba(c, a)
    ctx.shadowBlur = blur
    ctx.shadowOffsetX = off
    ctx.strokeStyle = '#000'
    ctx.beginPath()
    ctx.moveTo(p0[0] - off, p0[1])
    ctx.bezierCurveTo(p1[0] - off, p1[1], p2[0] - off, p2[1], p3[0] - off, p3[1])
    ctx.stroke()
  }
  ctx.restore()
}

function paintLight(ctx: CanvasRenderingContext2D, W: number, H: number, L: Layout, time: number, scratch: HTMLCanvasElement) {
  const hz = L.horizon / L.h
  // base: smoked slate sky falling into petrol and abyss beneath the glass
  const base = ctx.createLinearGradient(0, 0, 0, H)
  base.addColorStop(0, rgba(SKY_TOP, 1))
  base.addColorStop(Math.max(0.05, hz - 0.12), rgba(SKY_MID, 1))
  base.addColorStop(Math.min(0.95, hz + 0.08), rgba(TEAL, 1))
  base.addColorStop(Math.min(0.97, hz + 0.4), rgba(PETROL, 1))
  base.addColorStop(1, rgba(ABYSS, 1))
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = base
  ctx.fillRect(0, 0, W, H)

  const t = time
  const sway = (f: number, p: number) => Math.sin(t * f + p)
  ctx.globalCompositeOperation = 'screen'

  // main curtain: from the upper right, bending through the window and
  // spilling left across the upper glass rows (broad halo + bright core)
  // portrait: lift it so it crosses the open sky instead of hiding behind
  // the content that sits on the glass
  const lift = L.landscape ? 0 : 0.12
  const curtain: [number, number][] = [
    [1.04 + 0.02 * sway(0.11, 1), hz - 0.28 - lift],
    [0.9 + 0.03 * sway(0.09, 2), hz + 0.04 - lift + 0.02 * sway(0.13, 0)],
    [0.6 + 0.04 * sway(0.07, 4), hz + 0.22 - lift],
    [0.04 + 0.04 * sway(0.08, 3), hz + 0.3 - lift * 0.8 + 0.02 * sway(0.1, 5)],
  ]
  ribbon(ctx, W, H, curtain, 0.15, CELADON, 0.5 + 0.05 * sway(0.17, 1))
  // curtain ridges: thinner parallel folds give the aurora its structure
  for (const [dx, dy, a] of [
    [0, 0, 0.62],
    [0.04, -0.06, 0.38],
    [-0.035, 0.05, 0.3],
  ] as const) {
    ribbon(
      ctx,
      W,
      H,
      curtain.map(([x, y], i) => [x + dx * (i / 3) * (1 + 0.4 * sway(0.12, i)), y + dy * (i / 3)] as [number, number]),
      0.034,
      [86, 232, 200],
      a + 0.08 * sway(0.21, dx * 40),
    )
  }
  // faint ghost curtain in the upper-left sky
  ribbon(
    ctx,
    W,
    H,
    [
      [0.16 + 0.02 * sway(0.07, 2), -0.04],
      [0.28, hz * 0.45 + 0.02 * sway(0.09, 1)],
      [0.42 + 0.03 * sway(0.08, 3), hz * 0.85],
      [0.56, hz + 0.04],
    ],
    0.08,
    CELADON,
    0.22 + 0.04 * sway(0.11, 5),
  )
  // the curtain's bright fall over the right glass shoulder
  ribbon(
    ctx,
    W,
    H,
    [
      [1.0, hz - 0.12],
      [0.93 + 0.02 * sway(0.1, 1), hz + 0.1],
      [0.85, hz + 0.24 + 0.02 * sway(0.12, 3)],
      [0.66 + 0.03 * sway(0.09, 2), hz + 0.32],
    ],
    0.05,
    EMERALD,
    0.6 + 0.05 * sway(0.14, 4),
  )
  // emerald undercurrent through the upper-left glass rows
  ribbon(
    ctx,
    W,
    H,
    [
      [-0.06, hz + 0.46 + 0.02 * sway(0.09, 2)],
      [0.14 + 0.04 * sway(0.1, 6), hz + 0.22],
      [0.3, hz + 0.38 + 0.03 * sway(0.12, 1)],
      [0.52 + 0.03 * sway(0.08, 0), hz + 0.3],
    ],
    0.075,
    EMERALD,
    0.72 + 0.06 * sway(0.15, 3),
  )
  // crisp streaks through the glass rows: what the panes refract
  const streaks: Array<[[number, number][], number, Rgb, number]> = [
    [[[-0.05, hz + 0.42], [0.14, hz + 0.3], [0.3, hz + 0.21], [0.5, hz + 0.18]], 0.022, [64, 222, 176], 0.85],
    [[[0.02, hz + 0.58], [0.18, hz + 0.47], [0.3, hz + 0.42], [0.46, hz + 0.4]], 0.026, EMERALD, 0.55],
    [[[0.6, hz + 0.38], [0.74, hz + 0.27], [0.86, hz + 0.21], [1.03, hz + 0.15]], 0.022, [70, 226, 196], 0.75],
    [[[0.66, hz + 0.52], [0.8, hz + 0.44], [0.9, hz + 0.4], [1.04, hz + 0.36]], 0.02, CELADON, 0.42],
  ]
  for (const [pts, w, c, a] of streaks) {
    const d = 0.02 * sway(0.09, pts[0][0] * 10)
    ribbon(ctx, W, H, pts.map(([x, y], i) => [x + d * (i % 2 ? 1 : -1), y + d * 0.6] as [number, number]), w, c, a + 0.08 * sway(0.18, w * 100))
  }

  // bright core behind the content window
  const gx = 0.52
  const gy = L.valley ? hz + 0.06 : hz - 0.02
  softDot(ctx, gx * W, gy * H, Math.max(W, H) * (L.valley ? 0.3 : 0.4), GLOW, 0.42 + 0.05 * sway(0.2, 2))
  softDot(ctx, gx * W, gy * H, Math.max(W, H) * 0.12, [170, 238, 230], 0.42)
  ctx.globalCompositeOperation = 'source-over'

  // refraction (Glass ramune: each pane shows the light field magnified by
  // 1/0.84 and shifted). Done here, at low resolution, so it can follow the
  // moving light every frame for the price of one small blit per pane.
  if (scratch.width !== W || scratch.height !== H) {
    scratch.width = W
    scratch.height = H
  }
  const sx = scratch.getContext('2d')
  if (!sx) return
  sx.drawImage(ctx.canvas, 0, 0)
  const k = W / L.w
  const U = 0.84
  for (const p of L.tiles) {
    const z = p.size * k
    const x = p.x * k
    const y = p.y * k
    const dx = z * 0.16 * (0.7 + 0.6 * (hash(p.x + 91, p.y + 53) - 0.5))
    const dy = z * 0.16 * (0.55 + 0.6 * (hash(p.x + 17, p.y + 71) - 0.5))
    const sw = z * U
    const srcX = Math.max(0, Math.min(W - sw, x + (z - sw) / 2 - dx))
    const srcY = Math.max(0, Math.min(H - sw, y + (z - sw) / 2 - dy))
    ctx.save()
    ctx.translate(x, y)
    roundRect(ctx, z, z, z * RADIUS)
    ctx.clip()
    ctx.globalAlpha = 0.9
    ctx.drawImage(scratch, srcX, srcY, sw, sw, 0, 0, z, z)
    ctx.restore()
  }
  ctx.globalCompositeOperation = 'source-over'
}

/* ── grain (static, shared) ─────────────────────────────────────────── */

let grainUrl: string | null = null
function grain(): string {
  if (grainUrl) return grainUrl
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const x = c.getContext('2d')
  if (!x) return ''
  const img = x.createImageData(128, 128)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.round((Math.random() + Math.random()) * 127.5)
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v
    img.data[i + 3] = 255
  }
  x.putImageData(img, 0, 0)
  grainUrl = c.toDataURL()
  return grainUrl
}

/* ── component ──────────────────────────────────────────────────────── */

export function PeakGlassField({ className = '', dim = false }: { className?: string; dim?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const lightRef = useRef<HTMLCanvasElement>(null)
  const glassRef = useRef<HTMLCanvasElement>(null)
  const grainRef = useRef<HTMLDivElement>(null)
  const reduce = !!useReducedMotion()

  useEffect(() => {
    const root = rootRef.current
    const light = lightRef.current
    const glass = glassRef.current
    if (!root || !light || !glass) return
    const lctx = light.getContext('2d', { alpha: false })
    if (!lctx) return
    if (grainRef.current) grainRef.current.style.backgroundImage = `url(${grain()})`

    let L: Layout | null = null
    const scratch = document.createElement('canvas')
    let raf = 0
    let last = 0
    let visible = true
    const t0 = performance.now()

    const drawLight = (now: number) => {
      if (!L) return
      paintLight(lctx, light.width, light.height, L, reduce ? 6 : (now - t0) / 1000, scratch)
    }

    const loop = (now: number) => {
      raf = 0
      if (!visible || document.hidden || reduce) return
      if (now - last >= 1000 / FPS) {
        last = now
        drawLight(now)
      }
      raf = requestAnimationFrame(loop)
    }
    const kick = () => {
      if (!raf && visible && !document.hidden && !reduce) raf = requestAnimationFrame(loop)
    }

    const relayout = () => {
      const w = root.clientWidth
      const h = root.clientHeight
      if (w < 2 || h < 2) return
      if (L && L.w === w && L.h === h) return
      L = computeLayout(w, h)
      // light: tiny on purpose; the browser's upscale is the blur
      const lw = Math.max(140, Math.min(380, Math.round(w / 4)))
      const lh = Math.max(2, Math.round((lw * h) / w))
      light.width = lw
      light.height = lh
      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1)
      glass.width = Math.round(w * dpr)
      glass.height = Math.round(h * dpr)
      paintGlass(glass, L, dpr)
      drawLight(performance.now())
    }

    let pending = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(pending)
      pending = requestAnimationFrame(relayout)
    })
    ro.observe(root)
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      kick()
    })
    io.observe(root)
    const onVis = () => kick()
    document.addEventListener('visibilitychange', onVis)

    relayout()
    kick()
    return () => {
      cancelAnimationFrame(raf)
      cancelAnimationFrame(pending)
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [reduce])

  return (
    <div ref={rootRef} className={`${s.root} ${className}`} aria-hidden="true">
      <canvas ref={lightRef} className={s.light} />
      <canvas ref={glassRef} className={s.glass} />
      <div ref={grainRef} className={s.grain} />
      <div className={`${s.dim} ${dim ? s.dimOn : ''}`} />
    </div>
  )
}
