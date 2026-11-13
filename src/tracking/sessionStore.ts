import { create } from 'zustand'
import type { ActivitySaveResult, GeoPoint, TrackedActivityType } from '../api/types'
import { api } from '../api'
import { createRouteFilter, ROUTE_FILTERS, type RouteFilter } from '../sensors/geo'
import { watchGeolocation, type GpsStatus } from '../sensors/geolocation'
import { requestMotionPermission, watchSteps, type MotionStatus } from '../sensors/motion'
import { holdWakeLock, releaseWakeLock } from '../sensors/wakeLock'
import { simulate } from '../sensors/simulator'

export type SessionPhase = 'idle' | 'active' | 'paused' | 'saving' | 'saved' | 'error'

/** Walking: steps primary, GPS optional. Run: GPS primary + steps. Cycle: GPS only. */
export const USES = {
  walk: { motion: true, gps: true, gpsPrimary: false },
  run: { motion: true, gps: true, gpsPrimary: true },
  cycle: { motion: false, gps: true, gpsPrimary: true },
} satisfies Record<TrackedActivityType, { motion: boolean; gps: boolean; gpsPrimary: boolean }>

interface SessionState {
  phase: SessionPhase
  type: TrackedActivityType
  simulated: boolean
  startedAt: number | null
  /** accumulated moving time before the current resume */
  activeMs: number
  resumedAt: number | null
  steps: number
  distanceM: number
  route: GeoPoint[]
  gps: GpsStatus
  gpsAccuracy: number | null
  motion: MotionStatus
  result: ActivitySaveResult | null
  error: string | null

  setType(t: TrackedActivityType): void
  start(opts?: { simulate?: boolean }): Promise<void>
  pause(): void
  resume(): void
  finish(): Promise<void>
  retrySave(): Promise<void>
  discard(): void
}

const initial = {
  phase: 'idle' as SessionPhase,
  simulated: false,
  startedAt: null,
  activeMs: 0,
  resumedAt: null,
  steps: 0,
  distanceM: 0,
  route: [] as GeoPoint[],
  gps: 'off' as GpsStatus,
  gpsAccuracy: null,
  motion: 'off' as MotionStatus,
  result: null,
  error: null,
}

let detach: Array<() => void> = []
let filter: RouteFilter | null = null
let starting = false

export function elapsedMs(s: Pick<SessionState, 'activeMs' | 'resumedAt'>, now = Date.now()) {
  return s.activeMs + (s.resumedAt ? now - s.resumedAt : 0)
}

export const useSession = create<SessionState>()((set, get) => {
  const onSteps = (n: number) => set((s) => ({ steps: s.steps + n }))

  const onFix = (p: GeoPoint) => {
    if (!filter) return
    const v = filter.push(p)
    if (!v.accepted) return
    set((s) => ({ route: [...s.route, p], distanceM: s.distanceM + v.deltaM }))
  }

  function attachSensors() {
    const { type, simulated } = get()
    const uses = USES[type]
    if (simulated) {
      set({ gps: 'ok', gpsAccuracy: 6, motion: uses.motion ? 'ok' : 'off' })
      detach.push(simulate(type, uses.motion ? onSteps : () => {}, onFix))
      return
    }
    if (uses.motion && get().motion !== 'denied') detach.push(watchSteps(onSteps, (motion) => set({ motion })))
    if (uses.gps)
      detach.push(
        watchGeolocation(onFix, (gps, acc) => set({ gps, gpsAccuracy: acc ?? get().gpsAccuracy })),
      )
  }

  function detachSensors() {
    detach.forEach((d) => d())
    detach = []
  }

  async function save() {
    const s = get()
    set({ phase: 'saving', error: null })
    const end = Date.now()
    try {
      const result = await api.saveActivity({
        type: s.type,
        startedAt: new Date(s.startedAt ?? end).toISOString(),
        endedAt: new Date(end).toISOString(),
        durationSec: Math.round(elapsedMs(s, end) / 1000),
        steps: USES[s.type].motion ? s.steps : null,
        distanceM: Math.round(s.distanceM),
        route: s.route,
        sources: {
          motion: s.motion === 'ok',
          gps: s.route.length > 1,
          simulated: s.simulated,
        },
      })
      set({ phase: 'saved', result })
    } catch (e) {
      set({ phase: 'error', error: e instanceof Error ? e.message : 'Could not save activity' })
    }
  }

  return {
    ...initial,
    type: 'walk',

    setType(type) {
      if (get().phase === 'idle') set({ type })
    },

    async start(opts) {
      if (get().phase !== 'idle' || starting) return
      starting = true
      const simulated = Boolean(opts?.simulate)
      // Must run first, inside the user's tap, for iOS to show the prompt.
      let motionDenied = false
      if (!simulated && USES[get().type].motion) {
        motionDenied = (await requestMotionPermission()) === 'denied'
      }
      starting = false
      filter = createRouteFilter(ROUTE_FILTERS[get().type])
      const now = Date.now()
      set({
        ...initial,
        type: get().type,
        simulated,
        phase: 'active',
        startedAt: now,
        resumedAt: now,
        motion: motionDenied ? 'denied' : 'off',
      })
      attachSensors()
      void holdWakeLock()
    },

    pause() {
      const s = get()
      if (s.phase !== 'active') return
      detachSensors()
      set({ phase: 'paused', activeMs: elapsedMs(s), resumedAt: null })
    },

    resume() {
      if (get().phase !== 'paused') return
      filter?.breakSegment()
      set({ phase: 'active', resumedAt: Date.now() })
      attachSensors()
    },

    async finish() {
      const s = get()
      if (s.phase !== 'active' && s.phase !== 'paused') return
      detachSensors()
      void releaseWakeLock()
      set({ activeMs: elapsedMs(s), resumedAt: null })
      await save()
    },

    async retrySave() {
      if (get().phase === 'error') await save()
    },

    discard() {
      detachSensors()
      void releaseWakeLock()
      filter = null
      set({ ...initial, type: get().type })
    },
  }
})

export const isLive = (p: SessionPhase) => p === 'active' || p === 'paused'
