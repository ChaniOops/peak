import { create } from 'zustand'
import type { ActivitySaveResult, GeoPoint, TrackedActivityType } from '../api/types'
import { api } from '../api'
import { createRouteFilter, ROUTE_FILTERS, type RouteFilter } from '../sensors/geo'
import { watchGeolocation, type GpsStatus } from '../sensors/geolocation'
import { requestMotionPermission, watchSteps, type MotionStatus } from '../sensors/motion'
import { holdWakeLock, releaseWakeLock } from '../sensors/wakeLock'
import { simulate } from '../sensors/simulator'

export type SessionPhase = 'idle' | 'starting' | 'active' | 'paused' | 'saving' | 'saved' | 'error'

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
  /** start failed before anything was recorded */
  startError: string | null

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
  startError: null as string | null,
}

const PUSH_EVERY_MS = 5000

let detach: Array<() => void> = []
let filter: RouteFilter | null = null
let starting = false
let activityId: string | null = null
/** route samples already acknowledged by the backend */
let pushedUpTo = 0
let pushTimer: number | null = null
let pushing = false

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

  function totals(st: SessionState, now = Date.now()) {
    return {
      steps: USES[st.type].motion ? st.steps : null,
      distanceM: Math.round(st.distanceM),
      activeSec: Math.round(elapsedMs(st, now) / 1000),
    }
  }

  async function pushNow() {
    const st = get()
    if (!activityId || pushing || st.phase !== 'active') return
    pushing = true
    const upTo = st.route.length
    try {
      await api.pushActivity(activityId, totals(st), st.route.slice(pushedUpTo, upTo))
      pushedUpTo = upTo
    } catch {
      // cumulative totals: the next push carries everything, so a lost one is harmless
    } finally {
      pushing = false
    }
  }

  function startPushing() {
    stopPushing()
    pushTimer = window.setInterval(() => void pushNow(), PUSH_EVERY_MS)
  }

  function stopPushing() {
    if (pushTimer !== null) window.clearInterval(pushTimer)
    pushTimer = null
  }

  async function save() {
    const st = get()
    if (!activityId) return
    set({ phase: 'saving', error: null })
    try {
      const result = await api.finishActivity(activityId, totals(st), st.route.slice(pushedUpTo))
      activityId = null
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
      set({ phase: 'starting', startError: null })
      try {
        activityId = (await api.startActivity(get().type)).id
      } catch (e) {
        starting = false
        set({ phase: 'idle', startError: e instanceof Error ? e.message : 'Could not start the session' })
        return
      }
      starting = false
      pushedUpTo = 0
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
      startPushing()
      void holdWakeLock()
    },

    pause() {
      const s = get()
      if (s.phase !== 'active') return
      void pushNow()
      stopPushing()
      detachSensors()
      set({ phase: 'paused', activeMs: elapsedMs(s), resumedAt: null })
    },

    resume() {
      if (get().phase !== 'paused') return
      filter?.breakSegment()
      set({ phase: 'active', resumedAt: Date.now() })
      attachSensors()
      startPushing()
    },

    async finish() {
      const s = get()
      if (s.phase !== 'active' && s.phase !== 'paused') return
      stopPushing()
      detachSensors()
      void releaseWakeLock()
      set({ activeMs: elapsedMs(s), resumedAt: null })
      await save()
    },

    async retrySave() {
      if (get().phase === 'error') await save()
    },

    discard() {
      stopPushing()
      if (activityId) void api.discardActivity(activityId).catch(() => {})
      activityId = null
      detachSensors()
      void releaseWakeLock()
      filter = null
      set({ ...initial, type: get().type })
    },
  }
})

export const isLive = (p: SessionPhase) => p === 'active' || p === 'paused'
