/**
 * Demo fallback for indoor stages / laptops without sensors. Emits synthetic
 * steps and GPS fixes around a loop near the campus centre. Sessions recorded
 * this way are flagged `sources.simulated = true` and labelled in the UI.
 */
import type { GeoPoint, TrackedActivityType } from '../api/types'
import { CAMPUS } from '../config'

const PROFILE: Record<TrackedActivityType, { speedMps: number; cadence: number }> = {
  walk: { speedMps: 1.4, cadence: 1.8 },
  run: { speedMps: 3.1, cadence: 2.7 },
  cycle: { speedMps: 6.5, cadence: 0 },
}

// rough 900 m loop, offsets in metres (east, north)
const LOOP: Array<[number, number]> = [
  [0, 0], [120, 30], [230, 10], [300, 110], [280, 230], [170, 290],
  [40, 270], [-60, 200], [-90, 90], [-40, 20], [0, 0],
]

function offset(m: [number, number]) {
  const lat = CAMPUS.center.lat + m[1] / 111_320
  const lng = CAMPUS.center.lng + m[0] / (111_320 * Math.cos((CAMPUS.center.lat * Math.PI) / 180))
  return { lat, lng }
}

function pointAt(distanceM: number) {
  const segs = LOOP.slice(1).map((p, i) => {
    const a = LOOP[i]
    return { a, b: p, len: Math.hypot(p[0] - a[0], p[1] - a[1]) }
  })
  const total = segs.reduce((s, x) => s + x.len, 0)
  let d = distanceM % total
  for (const s of segs) {
    if (d <= s.len) {
      const f = d / s.len
      return offset([s.a[0] + (s.b[0] - s.a[0]) * f, s.a[1] + (s.b[1] - s.a[1]) * f])
    }
    d -= s.len
  }
  return offset(LOOP[0])
}

export function simulate(
  type: TrackedActivityType,
  onSteps: (n: number) => void,
  onFix: (p: GeoPoint) => void,
): () => void {
  const { speedMps, cadence } = PROFILE[type]
  let travelled = 0
  let stepAcc = 0
  let last = performance.now()
  const id = window.setInterval(() => {
    const now = performance.now()
    const dt = (now - last) / 1000
    last = now
    travelled += speedMps * dt * (0.9 + Math.random() * 0.2)
    stepAcc += cadence * dt
    const whole = Math.floor(stepAcc)
    if (whole > 0) {
      stepAcc -= whole
      onSteps(whole)
    }
    const p = pointAt(travelled)
    onFix({ ...p, t: Date.now(), accuracy: 6 })
  }, 1000)
  return () => window.clearInterval(id)
}
