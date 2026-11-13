import type { GeoPoint, TrackedActivityType } from '../api/types'

const R = 6_371_000

export function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export interface RouteFilterOptions {
  /** Reject fixes worse than this. */
  maxAccuracyM: number
  /** Ignore movement smaller than this (GPS wander while standing). */
  minMoveM: number
  /** Reject jumps implying a speed above this. */
  maxSpeedMps: number
}

/** Per-activity GPS sanity limits. */
export const ROUTE_FILTERS: Record<TrackedActivityType, RouteFilterOptions> = {
  walk: { maxAccuracyM: 35, minMoveM: 4, maxSpeedMps: 4 },
  run: { maxAccuracyM: 30, minMoveM: 4, maxSpeedMps: 9 },
  cycle: { maxAccuracyM: 35, minMoveM: 6, maxSpeedMps: 22 },
}

export type FixVerdict =
  | { accepted: true; deltaM: number }
  | { accepted: false; reason: 'inaccurate' | 'jitter' | 'too-fast' }

export interface RouteFilter {
  push(p: GeoPoint): FixVerdict
  /** Start a new segment (e.g. after pause): next fix adds no distance. */
  breakSegment(): void
}

export function createRouteFilter(opts: RouteFilterOptions): RouteFilter {
  let last: GeoPoint | null = null

  return {
    push(p) {
      if (p.accuracy !== undefined && p.accuracy > opts.maxAccuracyM) return { accepted: false, reason: 'inaccurate' }
      if (!last) {
        last = p
        return { accepted: true, deltaM: 0 }
      }
      const d = haversineM(last, p)
      const jitterFloor = Math.max(opts.minMoveM, (p.accuracy ?? 0) * 0.5)
      if (d < jitterFloor) return { accepted: false, reason: 'jitter' }
      const dt = (p.t - last.t) / 1000
      if (dt > 0 && d / dt > opts.maxSpeedMps) return { accepted: false, reason: 'too-fast' }
      last = p
      return { accepted: true, deltaM: d }
    },
    breakSegment() {
      last = null
    },
  }
}
