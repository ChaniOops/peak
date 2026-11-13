import { useMemo } from 'react'

/**
 * Procedural topographic contour lines. Deterministic per seed. Decorative only.
 */
export function TopoLines({
  seed = 1,
  rings = 8,
  className,
  cx = 200,
  cy = 200,
}: {
  seed?: number
  rings?: number
  className?: string
  cx?: number
  cy?: number
}) {
  const paths = useMemo(() => buildContours(seed, rings, cx, cy), [seed, rings, cx, cy])
  return (
    <svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          opacity={0.35 + (i / rings) * 0.65}
        />
      ))}
    </svg>
  )
}

function rand(seed: number) {
  let s = seed * 9301 + 49297
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

function buildContours(seed: number, rings: number, cx: number, cy: number): string[] {
  const r = rand(seed)
  const harmonics = Array.from({ length: 4 }, (_, i) => ({
    n: 2 + i + Math.floor(r() * 2),
    amp: 0.05 + r() * 0.09,
    phase: r() * Math.PI * 2,
  }))
  const out: string[] = []
  const N = 72
  for (let k = 0; k < rings; k++) {
    const base = 22 + k * (260 / rings)
    const pts: Array<[number, number]> = []
    for (let i = 0; i < N; i++) {
      const th = (i / N) * Math.PI * 2
      let f = 1
      for (const h of harmonics) f += h.amp * Math.sin(h.n * th + h.phase + k * 0.22)
      pts.push([cx + Math.cos(th) * base * f, cy + Math.sin(th) * base * f * 0.82])
    }
    out.push(closedCatmullRom(pts))
  }
  return out
}

function closedCatmullRom(p: Array<[number, number]>): string {
  const n = p.length
  let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`
  for (let i = 0; i < n; i++) {
    const p0 = p[(i - 1 + n) % n]
    const p1 = p[i]
    const p2 = p[(i + 1) % n]
    const p3 = p[(i + 2) % n]
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
  }
  return d + 'Z'
}
