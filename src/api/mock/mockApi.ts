/**
 * In-memory mock backend.
 *
 * It simulates backend behaviour (points engine, rankings, badge awards,
 * realtime) ONLY so the demo chain runs before Supabase lands. Every rule
 * marked `MOCK RULE` stands in for backend logic and must not be ported to
 * UI code. In Supabase mode none of this runs.
 *
 * State persists to localStorage and syncs between tabs of the same browser
 * via BroadcastChannel, so the student view and the organiser route can run
 * side by side. Cross-device sync needs the real backend.
 */
import type { Api } from '../client'
import { ApiError } from '../client'
import type {
  Activity,
  ActivitySaveResult,
  Badge,
  CampusEvent,
  Challenge,
  CheckIn,
  DailyStat,
  FeedItem,
  LeaderboardEntry,
  LeaderboardScope,
  NewActivity,
  Notice,
  RealtimeEvent,
  Redemption,
  Reward,
  StreakDay,
  SummitProgress,
  TodaySummary,
  Topic,
  UserProfile,
} from '../types'
import { DB_VERSION, SUMMIT_TARGET_STEPS, seedDb, type MockDb, type MockUser } from './fixtures'
import { dayKey, lastNDays, startOfWeek } from '../../lib/dates'
import { uid } from '../../lib/id'
import { formatDistance, formatSteps, activityVerb } from '../../lib/format'

const STORAGE_KEY = 'peak.mockdb'
const CHANNEL = 'peak.mock'
const ACTIVE_DAY_STEPS = 3000 // MOCK RULE: what counts as an active day

type Listener = { topics: Set<string>; cb: (e: RealtimeEvent) => void }
type SyncMessage = { topics: Topic[]; notices: Notice[] }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const latency = () => sleep(90 + Math.random() * 140)
const clone = <T,>(v: T): T => structuredClone(v)

function load(): MockDb {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const db = JSON.parse(raw) as MockDb
      if (db.version === DB_VERSION) return db
    }
  } catch {
    /* fall through to seed */
  }
  return seedDb()
}

/** MOCK RULE — stand-in for the backend points engine. */
function mockPointsFor(a: NewActivity): number {
  if (a.durationSec < 60) return 0
  const km = a.distanceM / 1000
  let pts = 0
  if (a.type === 'walk') pts = (a.steps ?? a.distanceM / 0.75) / 100
  if (a.type === 'run') pts = km * 12 + (a.steps ?? 0) / 400
  if (a.type === 'cycle') pts = km * 4
  return Math.max(5, Math.round(pts))
}

export class MockApi implements Api {
  readonly mode = 'mock' as const
  private db: MockDb = load()
  private listeners = new Set<Listener>()
  private channel: BroadcastChannel | null =
    typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null

  constructor() {
    this.persist()
    this.channel?.addEventListener('message', (ev: MessageEvent<SyncMessage>) => {
      this.db = load()
      for (const topic of ev.data.topics) this.emit({ topic })
      for (const notice of ev.data.notices) this.emit({ topic: 'notice', notice })
    })
    this.startClassmateTicker()
  }

  // ───────────────────────── internals

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.db))
    } catch {
      /* storage full or blocked: keep in memory */
    }
  }

  private emit(e: RealtimeEvent) {
    for (const l of this.listeners) if (l.topics.has(e.topic)) l.cb(e)
  }

  private commit(topics: Topic[], notices: Notice[] = []) {
    this.persist()
    const unique = [...new Set(topics)]
    for (const topic of unique) this.emit({ topic })
    for (const notice of notices) this.emit({ topic: 'notice', notice })
    this.channel?.postMessage({ topics: unique, notices } satisfies SyncMessage)
  }

  private get me(): MockUser {
    return this.db.users.find((u) => u.id === this.db.meId)!
  }

  private deptName(id: string) {
    return this.db.departments.find((d) => d.id === id)?.name ?? id
  }

  private today() {
    const k = dayKey(new Date())
    this.db.days[k] ??= { steps: 0, distanceM: 0, activeMin: 0, points: 0 }
    return this.db.days[k]
  }

  private weekSteps() {
    const from = dayKey(startOfWeek(new Date()))
    return Object.entries(this.db.days)
      .filter(([k]) => k >= from)
      .reduce((s, [, d]) => s + d.steps, 0)
  }

  private streakDays() {
    let n = 0
    const d = new Date()
    if ((this.db.days[dayKey(d)]?.steps ?? 0) < ACTIVE_DAY_STEPS) d.setDate(d.getDate() - 1)
    while ((this.db.days[dayKey(d)]?.steps ?? 0) >= ACTIVE_DAY_STEPS) {
      n++
      d.setDate(d.getDate() - 1)
    }
    return n
  }

  private profile(): UserProfile {
    const me = this.me
    return {
      id: me.id,
      displayName: me.name,
      departmentId: me.departmentId,
      departmentName: this.deptName(me.departmentId),
      role: me.role,
      movePoints: this.db.movePoints,
      streakDays: this.streakDays(),
    }
  }

  private award(userId: string, points: number) {
    const u = this.db.users.find((x) => x.id === userId)
    if (!u) return
    u.weekPoints += points
    if (userId === this.db.meId) {
      this.db.movePoints += points
      this.today().points += points
    }
  }

  private earnBadge(id: string, notices: Notice[]): Badge | null {
    const b = this.db.badges.find((x) => x.id === id)
    if (!b || b.earnedAt) return null
    b.earnedAt = new Date().toISOString()
    this.pushFeed(this.me.name, 'badge', `earned ${b.name}`, null)
    notices.push({ id: uid('n-'), title: 'Badge earned', body: b.name, points: null, tone: 'ice' })
    return clone(b)
  }

  private pushFeed(actorName: string, kind: FeedItem['kind'], text: string, points: number | null, deptId?: string) {
    const user = this.db.users.find((u) => u.name === actorName)
    this.db.feed.unshift({
      id: uid('f-'),
      kind,
      actorName,
      departmentName: this.deptName(deptId ?? user?.departmentId ?? ''),
      text,
      points,
      createdAt: new Date().toISOString(),
    })
    this.db.feed = this.db.feed.slice(0, 60)
  }

  /** MOCK RULE — challenge progress + completion bonus. */
  private bumpChallenges(driver: string, amount: number, notices: Notice[]) {
    for (const c of this.db.challenges) {
      if (c.driver !== driver || c.completed) continue
      if (driver === 'weekSteps') c.progress = amount
      else c.progress = Math.round((c.progress + amount) * 10) / 10
      if (c.progress >= c.target) {
        c.completed = true
        if (c.joined) {
          this.award(this.db.meId, c.rewardPoints)
          notices.push({
            id: uid('n-'),
            title: 'Challenge complete',
            body: c.title,
            points: c.rewardPoints,
            tone: 'accent',
          })
          this.pushFeed(this.me.name, 'challenge', `completed ${c.title}`, c.rewardPoints)
        }
        if (c.scope === 'department') this.earnBadge('b-dept', notices)
      }
    }
  }

  private toEvent(e: MockDb['events'][number]): CampusEvent {
    const mine = this.db.checkIns
      .filter((c) => c.eventId === e.id && c.userId === this.db.meId)
      .sort((a, b) => b.scannedAt.localeCompare(a.scannedAt))[0]
    const { qrToken: _qr, joined, ...rest } = e
    void _qr
    return {
      ...rest,
      joinedCount: joined.length,
      myStatus: mine ? mine.status : joined.includes(this.db.meId) ? 'joined' : 'none',
    }
  }

  private startClassmateTicker() {
    const tick = () => {
      const delay = 22_000 + Math.random() * 18_000
      setTimeout(() => {
        // only the focused tab drives simulated classmates, so two tabs don't double up
        if (document.visibilityState === 'visible' && document.hasFocus() && this.db.signedIn) {
          this.simulateClassmate()
        }
        tick()
      }, delay)
    }
    tick()
  }

  private simulateClassmate() {
    const others = this.db.users.filter((u) => u.id !== this.db.meId)
    const u = others[Math.floor(Math.random() * others.length)]
    const type = (['walk', 'run', 'cycle'] as const)[Math.floor(Math.random() * 3)]
    const distanceM = type === 'cycle' ? 5000 + Math.random() * 9000 : 1500 + Math.random() * 4000
    const steps = type === 'walk' ? Math.round(distanceM / 0.75) : null
    const pts = mockPointsFor({
      type,
      distanceM,
      steps,
      durationSec: 1200,
      startedAt: '',
      endedAt: '',
      route: [],
      sources: { motion: true, gps: true, simulated: true },
    })
    this.award(u.id, pts)
    u.weekSteps += steps ?? 0
    const notices: Notice[] = []
    if (u.departmentId === this.me.departmentId) this.bumpChallenges('deptDistanceKm', distanceM / 1000, notices)
    const what = type === 'walk' ? `walked ${formatSteps(steps ?? 0)} steps` : `${activityVerb(type)} ${formatDistance(distanceM)}`
    this.pushFeed(u.name, 'activity', what, pts)
    this.commit(['feed', 'leaderboard', 'challenges', 'profile'], notices)
  }

  // ───────────────────────── session

  async getSession() {
    await latency()
    return this.db.signedIn ? this.profile() : null
  }

  async signInDemo() {
    await latency()
    this.db.signedIn = true
    this.commit(['profile'])
    return this.profile()
  }

  async signInWithEmail(): Promise<void> {
    throw new ApiError('Email sign-in needs the backend. Use the demo account for now.', 'not_available')
  }

  async signOut() {
    this.db.signedIn = false
    this.commit(['profile'])
  }

  async resetDemo() {
    this.db = seedDb()
    this.commit([
      'profile',
      'today',
      'summit',
      'activities',
      'feed',
      'challenges',
      'leaderboard',
      'events',
      'checkins',
      'badges',
      'rewards',
    ])
  }

  // ───────────────────────── me

  async getMe() {
    await latency()
    return this.profile()
  }

  async getToday(): Promise<TodaySummary> {
    await latency()
    const t = this.db.days[dayKey(new Date())]
    return {
      steps: t?.steps ?? 0,
      distanceM: t?.distanceM ?? 0,
      activeMinutes: t?.activeMin ?? 0,
      movePoints: t?.points ?? 0,
    }
  }

  async getStreak(): Promise<StreakDay[]> {
    await latency()
    return lastNDays(7).map((d) => ({
      date: d.toISOString(),
      active: (this.db.days[dayKey(d)]?.steps ?? 0) >= ACTIVE_DAY_STEPS,
    }))
  }

  async getSummit(): Promise<SummitProgress> {
    await latency()
    const start = startOfWeek(new Date())
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    return {
      weekStart: start.toISOString(),
      weekEnd: end.toISOString(),
      steps: this.weekSteps(),
      targetSteps: SUMMIT_TARGET_STEPS,
    }
  }

  async getWeekly(): Promise<DailyStat[]> {
    await latency()
    return lastNDays(7).map((d) => {
      const day = this.db.days[dayKey(d)]
      return { date: d.toISOString(), steps: day?.steps ?? 0, distanceM: day?.distanceM ?? 0 }
    })
  }

  async listActivities(limit = 20): Promise<Activity[]> {
    await latency()
    return clone(this.db.activities.slice(0, limit))
  }

  async saveActivity(input: NewActivity): Promise<ActivitySaveResult> {
    await sleep(500)
    const notices: Notice[] = []
    const badgesEarned: Badge[] = []
    const prevBest = Math.max(0, ...this.db.activities.map((a) => a.distanceM))
    const summitBefore = this.weekSteps()

    const pointsAwarded = mockPointsFor(input)
    const activity: Activity = { ...clone(input), id: uid('a-'), pointsAwarded }
    this.db.activities.unshift(activity)

    const day = this.today()
    day.steps += input.steps ?? 0
    day.distanceM += Math.round(input.distanceM)
    day.activeMin += Math.round(input.durationSec / 60)
    this.award(this.db.meId, pointsAwarded)
    this.me.weekSteps += input.steps ?? 0

    const label = input.type === 'walk' && input.steps ? `${formatSteps(input.steps)} steps` : formatDistance(input.distanceM)
    this.pushFeed(this.me.name, 'activity', `${activityVerb(input.type)} ${label}`, pointsAwarded)
    notices.push({
      id: uid('n-'),
      title: 'Activity saved',
      body: label,
      points: pointsAwarded,
      tone: 'accent',
    })

    const maybe = (b: Badge | null) => b && badgesEarned.push(b)
    if (this.db.activities.length === 1) maybe(this.earnBadge('b-first', notices))
    if (input.distanceM > prevBest && prevBest > 0) maybe(this.earnBadge('b-pb', notices))
    if (summitBefore < SUMMIT_TARGET_STEPS && this.weekSteps() >= SUMMIT_TARGET_STEPS)
      maybe(this.earnBadge('b-summit', notices))
    if (this.streakDays() >= 3) maybe(this.earnBadge('b-streak3', notices))

    this.bumpChallenges('sessions', 1, notices)
    this.bumpChallenges('deptDistanceKm', input.distanceM / 1000, notices)

    this.commit(
      ['profile', 'today', 'summit', 'activities', 'feed', 'challenges', 'leaderboard', 'badges', 'rewards'],
      notices,
    )
    return { activity: clone(activity), pointsAwarded, badgesEarned }
  }

  // ───────────────────────── social

  async getFeed(limit = 20) {
    await latency()
    return clone(this.db.feed.slice(0, limit))
  }

  async listChallenges(): Promise<Challenge[]> {
    await latency()
    return this.db.challenges.map((c) => {
      const { driver: _d, completed: _c, ...rest } = c
      void _d
      void _c
      return { ...rest }
    })
  }

  async joinChallenge(id: string) {
    await latency()
    const c = this.db.challenges.find((x) => x.id === id)
    if (!c) throw new ApiError('Challenge not found', 'not_found')
    c.joined = true
    this.commit(['challenges'])
  }

  /** MOCK RULE — rankings. Department score = average weekly points per member,
   * so participation across a department matters, not just its top athletes. */
  async getLeaderboard(scope: LeaderboardScope): Promise<LeaderboardEntry[]> {
    await latency()
    if (scope === 'individual') {
      return [...this.db.users]
        .sort((a, b) => b.weekPoints - a.weekPoints)
        .map((u, i) => ({
          id: u.id,
          rank: i + 1,
          name: u.name,
          subtitle: this.deptName(u.departmentId),
          points: u.weekPoints,
          isMe: u.id === this.db.meId,
        }))
    }
    return this.db.departments
      .map((d) => {
        const members = this.db.users.filter((u) => u.departmentId === d.id)
        const avg = members.length ? members.reduce((s, u) => s + u.weekPoints, 0) / members.length : 0
        return { d, members: members.length, avg: Math.round(avg) }
      })
      .sort((a, b) => b.avg - a.avg)
      .map((x, i) => ({
        id: x.d.id,
        rank: i + 1,
        name: x.d.name,
        subtitle: `${x.members} members · avg per member`,
        points: x.avg,
        isMe: x.d.id === this.me.departmentId,
      }))
  }

  // ───────────────────────── events & check-ins

  async listEvents() {
    await latency()
    return [...this.db.events].sort((a, b) => a.startsAt.localeCompare(b.startsAt)).map((e) => this.toEvent(e))
  }

  async getEvent(id: string) {
    await latency()
    const e = this.db.events.find((x) => x.id === id)
    if (!e) throw new ApiError('Event not found', 'not_found')
    return this.toEvent(e)
  }

  async joinEvent(id: string) {
    await latency()
    const e = this.db.events.find((x) => x.id === id)
    if (!e) throw new ApiError('Event not found', 'not_found')
    if (!e.joined.includes(this.db.meId)) {
      if (e.joined.length >= e.capacity) throw new ApiError('This event is full', 'full')
      e.joined.push(this.db.meId)
    }
    this.commit(['events'])
  }

  async checkIn(qrPayload: string): Promise<CheckIn> {
    await sleep(400)
    const code = parseCheckInCode(qrPayload)
    const e = code && this.db.events.find((x) => x.id === code.eventId)
    if (!code || !e || e.qrToken !== code.token) {
      throw new ApiError('This QR code isn’t a valid Peak event check-in.', 'invalid_qr')
    }
    const existing = this.db.checkIns.find(
      (c) => c.eventId === e.id && c.userId === this.db.meId && c.status !== 'rejected',
    )
    if (existing) return clone(existing)

    if (!e.joined.includes(this.db.meId)) e.joined.push(this.db.meId)
    const ci: CheckIn = {
      id: uid('ci-'),
      eventId: e.id,
      eventTitle: e.title,
      userId: this.db.meId,
      userName: this.me.name,
      departmentName: this.deptName(this.me.departmentId),
      status: 'pending',
      scannedAt: new Date().toISOString(),
      decidedAt: null,
    }
    this.db.checkIns.push(ci)
    this.commit(['events', 'checkins'])
    return clone(ci)
  }

  async listMyCheckIns() {
    await latency()
    return clone(this.db.checkIns.filter((c) => c.userId === this.db.meId)).reverse()
  }

  async getEventQrPayload(eventId: string) {
    await latency()
    const e = this.db.events.find((x) => x.id === eventId)
    if (!e) throw new ApiError('Event not found', 'not_found')
    return `${window.location.origin}/play/scan?code=${encodeURIComponent(`${e.id}.${e.qrToken}`)}`
  }

  async listEventCheckIns(eventId: string) {
    await latency()
    return clone(this.db.checkIns.filter((c) => c.eventId === eventId)).reverse()
  }

  async decideCheckIn(checkInId: string, decision: 'verified' | 'rejected') {
    await latency()
    const ci = this.db.checkIns.find((c) => c.id === checkInId)
    if (!ci) throw new ApiError('Check-in not found', 'not_found')
    if (ci.status !== 'pending') return
    const e = this.db.events.find((x) => x.id === ci.eventId)!
    ci.status = decision
    ci.decidedAt = new Date().toISOString()

    const notices: Notice[] = []
    const isMe = ci.userId === this.db.meId
    if (decision === 'verified') {
      this.award(ci.userId, e.pointsOnVerify)
      this.pushFeed(ci.userName, 'checkin', `verified at ${e.title}`, e.pointsOnVerify)
      if (isMe) {
        notices.push({
          id: uid('n-'),
          title: 'Check-in verified',
          body: e.title,
          points: e.pointsOnVerify,
          tone: 'ice',
        })
        this.earnBadge('b-court', notices)
        this.bumpChallenges('verifiedSports', 1, notices)
        this.bumpChallenges('sessions', 1, notices)
      }
    } else if (isMe) {
      notices.push({
        id: uid('n-'),
        title: 'Check-in not approved',
        body: `${e.title}: talk to the organiser`,
        points: null,
        tone: 'danger',
      })
    }
    this.commit(
      ['checkins', 'events', 'feed', 'leaderboard', 'profile', 'today', 'challenges', 'badges', 'rewards'],
      notices,
    )
  }

  // ───────────────────────── badges & rewards

  async listBadges() {
    await latency()
    return clone(this.db.badges)
  }

  async listRewards(): Promise<Reward[]> {
    await latency()
    return this.db.rewards.map((r) => {
      const blockedReason =
        r.stock <= 0
          ? 'Out of stock'
          : this.db.movePoints < r.cost
            ? `${r.cost - this.db.movePoints} more MovePoints needed`
            : null
      return {
        id: r.id,
        title: r.title,
        description: r.description,
        cost: r.cost,
        canRedeem: blockedReason === null,
        blockedReason,
      }
    })
  }

  async redeemReward(rewardId: string): Promise<Redemption> {
    await sleep(350)
    const r = this.db.rewards.find((x) => x.id === rewardId)
    if (!r) throw new ApiError('Reward not found', 'not_found')
    if (r.stock <= 0) throw new ApiError('Out of stock', 'out_of_stock')
    if (this.db.movePoints < r.cost) throw new ApiError('Not enough MovePoints', 'insufficient_points')
    r.stock -= 1
    this.db.movePoints -= r.cost
    const red: Redemption = {
      id: uid('rd-'),
      rewardTitle: r.title,
      status: 'requested',
      code: `PEAK-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      createdAt: new Date().toISOString(),
    }
    this.db.redemptions.unshift(red)
    this.commit(['rewards', 'profile'], [
      { id: uid('n-'), title: 'Reward redeemed', body: r.title, points: -r.cost, tone: 'ember' },
    ])
    return clone(red)
  }

  async listRedemptions() {
    await latency()
    return clone(this.db.redemptions)
  }

  // ───────────────────────── realtime

  subscribe(topics: Array<Topic | 'notice'>, cb: (e: RealtimeEvent) => void) {
    const l: Listener = { topics: new Set(topics), cb }
    this.listeners.add(l)
    return () => {
      this.listeners.delete(l)
    }
  }
}

/** Accepts either the deep-link URL the organiser shows, or a bare `eventId.token`. */
function parseCheckInCode(raw: string): { eventId: string; token: string } | null {
  let code = raw.trim()
  try {
    const url = new URL(code)
    code = url.searchParams.get('code') ?? ''
  } catch {
    /* not a URL */
  }
  const [eventId, token] = code.split('.')
  return eventId && token ? { eventId, token } : null
}
