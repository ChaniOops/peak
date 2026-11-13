/**
 * Supabase translation layer: backend rows/RPCs → frontend domain types.
 *
 * The backend owns the schema (`database.types.ts` is copied verbatim from the
 * backend's generated types). This file adapts to it — never the reverse. All
 * authoritative numbers (points, ranks, streaks, everest progress, badge
 * awards) are read from the backend; nothing here computes them.
 */
import { createClient, type RealtimeChannel, type Session, type SupabaseClient } from '@supabase/supabase-js'
import type { Api } from '../client'
import { ApiError } from '../client'
import type { Database, Json } from './database.types'
import type {
  Activity,
  ActivitySaveResult,
  Badge,
  CampusEvent,
  Challenge,
  CheckIn,
  CheckInStatus,
  DailyStat,
  FeedItem,
  GeoPoint,
  LeaderboardEntry,
  LeaderboardScope,
  LiveTotals,
  MyEventStatus,
  Notice,
  RealtimeEvent,
  Redemption,
  Reward,
  StreakDay,
  SummitProgress,
  Topic,
  TrackedActivityType,
  UserProfile,
} from '../types'
import { dayKey, lastNDays } from '../../lib/dates'
import { uid } from '../../lib/id'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const demoEmail = import.meta.env.VITE_DEMO_EMAIL
const demoPassword = import.meta.env.VITE_DEMO_PASSWORD

export const supabaseConfigured = Boolean(url && anonKey)

type Fn = Database['public']['Functions']
type Row<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
type ParticipationStatus = Database['public']['Enums']['participation_status']
type PointReason = Database['public']['Enums']['point_reason']

// ───────────────────────── shapes of Json-returning RPCs (from backend handoff)

interface HomeJson {
  profile: { id: string; display_name: string; role: UserProfile['role'] | 'admin'; department_id: string | null; department_name: string | null }
  points: { total: number; week: number; today: number; spendable: number }
  streak: { days: number; active_today: boolean }
  today: { steps: number; distance_m: number; active_minutes: number; activities: number }
}

interface FinishJson {
  activity: Row<'activities'>
  points: { base: number; daily: number; streak: number; personal_best: number; challenges: number; total: number }
  completed_challenges: Array<{ title: string }>
  new_badges: Array<{ id: string; name: string; description: string; icon_key: string }>
}

// ───────────────────────── errors

const FRIENDLY: Record<string, string> = {
  not_authenticated: 'Please sign in again.',
  activity_not_found: 'That session no longer exists.',
  activity_not_live: 'That session already ended.',
  challenge_not_open: 'This challenge isn’t open right now.',
  event_not_found: 'Event not found.',
  event_not_open: 'This event isn’t open.',
  event_full: 'This event is full.',
  invalid_checkin_code: 'This QR code isn’t a valid Peak event check-in.',
  checkin_window_closed: 'Check-in opens 30 minutes before the event and closes 30 minutes after.',
  checkin_rejected: 'Your check-in for this event was not approved.',
  not_event_organiser: 'Only this event’s organiser can do that.',
  cannot_verify_self: 'Organisers can’t verify themselves.',
  participant_not_found: 'That participant isn’t registered.',
  participant_not_checked_in: 'That participant hasn’t checked in yet.',
  reward_not_found: 'Reward not found.',
  reward_out_of_stock: 'Out of stock.',
  insufficient_points: 'Not enough MovePoints.',
  'Invalid login credentials': 'Wrong email or password.',
}

function toApiError(e: { message?: string } | null | undefined, fallback = 'Something went wrong'): ApiError {
  const raw = e?.message ?? fallback
  const key = Object.keys(FRIENDLY).find((k) => raw.includes(k))
  return new ApiError(key ? FRIENDLY[key] : raw, key ?? 'unknown')
}

async function unwrap<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<NonNullable<T>> {
  const { data, error } = await p
  if (error) throw toApiError(error)
  if (data === null || data === undefined) throw new ApiError('Empty response', 'empty')
  return data
}

/** For void RPCs (discard etc.) where data is legitimately null. */
async function run(p: PromiseLike<{ error: { message: string } | null }>): Promise<void> {
  const { error } = await p
  if (error) throw toApiError(error)
}

const METRIC_UNIT: Record<Database['public']['Enums']['challenge_metric'], string> = {
  steps: 'steps',
  distance_m: 'km',
  active_minutes: 'min',
  sessions: 'sessions',
  points: 'pts',
  verified_events: 'events',
}

// ───────────────────────── mappers

const STATUS_FROM_PARTICIPATION: Record<ParticipationStatus, MyEventStatus> = {
  registered: 'joined',
  checked_in: 'pending',
  verified: 'verified',
  rejected: 'rejected',
}

const LEDGER_TEXT: Record<PointReason, string> = {
  activity: 'tracked an activity',
  daily_active: 'got moving today',
  streak: 'kept the streak alive',
  personal_best: 'set a personal best',
  event: 'verified at a campus event',
  challenge: 'completed a challenge',
  team_challenge: 'completed a team challenge',
}

const BREAKDOWN_LABEL: Array<[keyof FinishJson['points'], string]> = [
  ['base', 'Activity'],
  ['daily', 'First move today'],
  ['streak', 'Streak'],
  ['personal_best', 'Personal best'],
  ['challenges', 'Challenges'],
]

function mapActivity(r: Pick<Row<'activities'>, 'id' | 'type' | 'started_at' | 'ended_at' | 'active_s' | 'steps' | 'distance_m' | 'points'>): Activity {
  return {
    id: r.id,
    type: r.type,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    durationSec: r.active_s,
    steps: r.type === 'cycle' ? null : r.steps,
    distanceM: r.distance_m,
    pointsAwarded: r.points,
  }
}

type EventRow = Fn['get_events']['Returns'][number]
function mapEvent(e: EventRow): CampusEvent {
  return {
    id: e.id,
    title: e.title,
    sport: e.sport,
    venue: e.venue,
    startsAt: e.starts_at,
    endsAt: e.ends_at,
    organiserName: e.organiser_name ?? 'Organiser',
    capacity: e.capacity ?? null,
    joinedCount: e.participant_count,
    pointsOnVerify: e.points,
    myStatus: e.my_status ? STATUS_FROM_PARTICIPATION[e.my_status] : 'none',
  }
}

function checkInStatus(s: ParticipationStatus): CheckInStatus {
  return s === 'verified' ? 'verified' : s === 'rejected' ? 'rejected' : 'pending'
}

/** CheckIn identity in the backend is (event, user); keep it opaque to the UI. */
const checkInId = (eventId: string, userId: string) => `${eventId}:${userId}`

function routeJson(points: GeoPoint[]): Json {
  return points.map((p) => ({ lat: p.lat, lng: p.lng, accuracy: p.accuracy ?? null, t: new Date(p.t).toISOString() }))
}

// ───────────────────────── adapter

export class SupabaseApi implements Api {
  readonly mode = 'supabase' as const
  readonly demoAvailable = Boolean(demoEmail && demoPassword)

  private sb: SupabaseClient<Database> = createClient<Database>(url!, anonKey!)
  private listeners = new Set<{ topics: Set<string>; cb: (e: RealtimeEvent) => void }>()
  private channels: RealtimeChannel[] = []
  private userId: string | null = null
  private homeCache: { at: number; p: Promise<HomeJson> } | null = null
  private departments: Promise<Map<string, string>> | null = null
  private badgeNames = new Map<string, string>()
  private leaderboardTimer: number | null = null

  constructor() {
    this.sb.auth.onAuthStateChange((_event, session) => this.onSession(session))
  }

  // ───── realtime → topics

  private emit(e: RealtimeEvent) {
    for (const l of this.listeners) if (l.topics.has(e.topic)) l.cb(e)
  }

  private emitTopics(...topics: Topic[]) {
    this.homeCache = null
    for (const topic of topics) this.emit({ topic })
  }

  private notice(n: Omit<Notice, 'id'>) {
    this.emit({ topic: 'notice', notice: { id: uid('n-'), ...n } })
  }

  private onSession(session: Session | null) {
    const next = session?.user.id ?? null
    if (next === this.userId) return
    this.userId = next
    this.homeCache = null
    for (const ch of this.channels) void this.sb.removeChannel(ch)
    this.channels = []
    if (!next) {
      this.emitTopics('profile')
      return
    }
    void this.sb.realtime.setAuth(session!.access_token)
    const uidFilter = `user_id=eq.${next}`

    const own = this.sb
      .channel(`peak-own-${next}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities', filter: uidFilter }, () =>
        this.emitTopics('today', 'summit', 'activities', 'profile'),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'points_ledger', filter: uidFilter }, (p) => {
        this.emitTopics('profile', 'today', 'rewards', 'feed', 'challenges')
        const row = p.new as Partial<Row<'points_ledger'>>
        // live activity points update on every push: only toast one-off awards
        if (p.eventType === 'INSERT' && row.reason && row.reason !== 'activity' && row.amount) {
          this.notice({
            title: row.reason === 'event' ? 'Check-in verified' : 'MovePoints',
            body: LEDGER_TEXT[row.reason].replace(/^./, (c) => c.toUpperCase()),
            points: row.amount,
            tone: row.reason === 'event' ? 'ice' : 'accent',
          })
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_badges', filter: uidFilter }, (p) => {
        this.emitTopics('badges')
        const id = (p.new as Partial<Row<'user_badges'>>).badge_id ?? ''
        this.notice({ title: 'Badge earned', body: this.badgeNames.get(id) ?? 'New badge', points: null, tone: 'ice' })
      })
      // RLS limits this to my own rows, or my events' rows if I organise
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_participants' }, (p) => {
        this.emitTopics('checkins', 'events')
        const row = p.new as Partial<Row<'event_participants'>>
        if (row.user_id === next && row.status === 'rejected') {
          this.notice({ title: 'Check-in not approved', body: 'Talk to the organiser', points: null, tone: 'danger' })
        }
      })
      .subscribe()

    // payload-free pulse whenever anyone's points change; debounce refetches
    const pulse = this.sb
      .channel('leaderboard')
      .on('broadcast', { event: 'changed' }, () => {
        if (this.leaderboardTimer !== null) return
        this.leaderboardTimer = window.setTimeout(() => {
          this.leaderboardTimer = null
          this.emitTopics('leaderboard', 'challenges')
        }, 1500)
      })
      .subscribe()

    this.channels = [own, pulse]
    this.emitTopics('profile')
  }

  subscribe(topics: Array<Topic | 'notice'>, cb: (e: RealtimeEvent) => void) {
    const l = { topics: new Set<string>(topics), cb }
    this.listeners.add(l)
    return () => {
      this.listeners.delete(l)
    }
  }

  // ───── shared reads

  private home(): Promise<HomeJson> {
    if (this.homeCache && Date.now() - this.homeCache.at < 1000) return this.homeCache.p
    const p = unwrap(this.sb.rpc('get_home')).then((j) => j as unknown as HomeJson)
    this.homeCache = { at: Date.now(), p }
    p.catch(() => (this.homeCache = null))
    return p
  }

  private deptNames(): Promise<Map<string, string>> {
    this.departments ??= unwrap(this.sb.from('departments').select('id,name')).then(
      (rows) => new Map(rows.map((d) => [d.id, d.name])),
    )
    return this.departments
  }

  private requireUser(): string {
    if (!this.userId) throw new ApiError(FRIENDLY.not_authenticated, 'not_authenticated')
    return this.userId
  }

  // ───── session

  async getSession() {
    const { data } = await this.sb.auth.getSession()
    if (!data.session) return null
    this.onSession(data.session)
    return this.getMe()
  }

  async signInDemo() {
    if (!demoEmail || !demoPassword) throw new ApiError('Demo account not configured', 'not_available')
    return this.signIn(demoEmail, demoPassword)
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password })
    if (error) throw toApiError(error)
    this.onSession(data.session)
    return this.getMe()
  }

  async signOut() {
    await this.sb.auth.signOut()
    this.onSession(null)
  }

  // ───── me

  async getMe(): Promise<UserProfile> {
    const h = await this.home()
    return {
      id: h.profile.id,
      displayName: h.profile.display_name,
      departmentId: h.profile.department_id ?? '',
      departmentName: h.profile.department_name ?? '',
      role: h.profile.role === 'student' ? 'student' : 'organiser',
      movePoints: h.points.spendable,
      streakDays: h.streak.days,
    }
  }

  async getToday() {
    const h = await this.home()
    return {
      steps: h.today.steps,
      distanceM: h.today.distance_m,
      activeMinutes: h.today.active_minutes,
      movePoints: h.points.today,
    }
  }

  /** A day is active when the backend awarded its once-a-day `daily_active` bonus. */
  async getStreak(): Promise<StreakDay[]> {
    const days = lastNDays(7)
    const rows = await unwrap(
      this.sb.from('points_ledger').select('earned_at').eq('reason', 'daily_active').gte('earned_at', days[0].toISOString()),
    )
    const active = new Set(rows.map((r) => dayKey(new Date(r.earned_at))))
    return days.map((d) => ({ date: d.toISOString(), active: active.has(dayKey(d)) }))
  }

  async getSummit(): Promise<SummitProgress> {
    const [e] = await unwrap(this.sb.rpc('get_everest'))
    const start = new Date(e.week_start)
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    return { weekStart: start.toISOString(), weekEnd: end.toISOString(), steps: e.current_steps, targetSteps: e.target_steps }
  }

  /** Per-day totals of my own activities (display aggregation only). */
  async getWeekly(): Promise<DailyStat[]> {
    const days = lastNDays(7)
    const rows = await unwrap(
      this.sb
        .from('activities')
        .select('started_at,steps,distance_m,type')
        .neq('status', 'discarded')
        .gte('started_at', days[0].toISOString()),
    )
    const by = new Map<string, { steps: number; distanceM: number }>()
    for (const r of rows) {
      const k = dayKey(new Date(r.started_at))
      const cur = by.get(k) ?? { steps: 0, distanceM: 0 }
      cur.steps += r.type === 'cycle' ? 0 : r.steps
      cur.distanceM += r.distance_m
      by.set(k, cur)
    }
    return days.map((d) => ({ date: d.toISOString(), ...(by.get(dayKey(d)) ?? { steps: 0, distanceM: 0 }) }))
  }

  async listActivities(limit = 20) {
    const rows = await unwrap(
      this.sb.from('activities').select('*').eq('status', 'completed').order('started_at', { ascending: false }).limit(limit),
    )
    return rows.map(mapActivity)
  }

  // ───── live tracking

  async startActivity(type: TrackedActivityType) {
    const row = await unwrap(this.sb.rpc('start_activity', { p_type: type }))
    return { id: row.id }
  }

  async pushActivity(id: string, t: LiveTotals, newRoute: GeoPoint[]) {
    await unwrap(
      this.sb.rpc('push_activity', {
        p_activity_id: id,
        p_steps: t.steps ?? 0,
        p_distance_m: t.distanceM,
        p_active_s: t.activeSec,
        p_route: routeJson(newRoute),
      }),
    )
  }

  async finishActivity(id: string, t: LiveTotals, newRoute: GeoPoint[]): Promise<ActivitySaveResult> {
    const raw = await unwrap(
      this.sb.rpc('finish_activity', {
        p_activity_id: id,
        p_steps: t.steps ?? 0,
        p_distance_m: t.distanceM,
        p_active_s: t.activeSec,
        p_route: routeJson(newRoute),
      }),
    )
    const j = raw as unknown as FinishJson
    this.emitTopics('today', 'summit', 'activities', 'profile', 'challenges', 'badges', 'leaderboard', 'feed')
    return {
      activity: mapActivity(j.activity),
      pointsAwarded: j.points.total,
      breakdown: BREAKDOWN_LABEL.map(([k, label]) => ({ label, points: j.points[k] })).filter((b) => b.points > 0),
      completedChallenges: j.completed_challenges.map((c) => c.title),
      badgesEarned: j.new_badges.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        category: null,
        earnedAt: new Date().toISOString(),
      })),
    }
  }

  async discardActivity(id: string) {
    await run(this.sb.rpc('discard_activity', { p_activity_id: id }))
  }

  // ───── social

  /** No campus-wide feed exists in the backend yet: show my own ledger. */
  async getFeed(limit = 20): Promise<FeedItem[]> {
    const [me, rows] = await Promise.all([
      this.getMe(),
      unwrap(this.sb.from('points_ledger').select('*').order('earned_at', { ascending: false }).limit(limit)),
    ])
    return rows.map((r) => ({
      id: String(r.id),
      kind: r.reason === 'event' ? 'checkin' : r.reason.includes('challenge') ? 'challenge' : 'activity',
      actorName: me.displayName,
      departmentName: me.departmentName,
      text: LEDGER_TEXT[r.reason],
      points: r.amount,
      createdAt: r.earned_at,
    }))
  }

  async listChallenges(): Promise<Challenge[]> {
    const rows = await unwrap(this.sb.rpc('get_challenges'))
    return rows.map((c) => {
      const km = c.metric === 'distance_m'
      const unit = METRIC_UNIT[c.metric]
      return {
        id: c.id,
        title: c.title,
        description: c.description,
        scope: c.scope,
        unit,
        progress: km ? Math.round(c.progress / 100) / 10 : c.progress,
        target: km ? Math.round(c.target / 100) / 10 : c.target,
        rewardPoints: c.reward_points,
        endsAt: c.ends_at,
        joined: c.joined,
      }
    })
  }

  async joinChallenge(id: string) {
    await run(this.sb.rpc('join_challenge', { p_challenge_id: id }))
    this.emitTopics('challenges', 'profile')
  }

  async getLeaderboard(scope: LeaderboardScope): Promise<LeaderboardEntry[]> {
    if (scope === 'individual') {
      const rows = await unwrap(this.sb.rpc('get_individual_leaderboard', { p_period: 'week', p_limit: 50 }))
      return rows.map((r) => ({
        id: r.user_id,
        rank: r.rank,
        name: r.display_name,
        subtitle: r.department_name ?? '',
        points: r.points,
        isMe: r.is_me,
      }))
    }
    const rows = await unwrap(this.sb.rpc('get_department_leaderboard', { p_period: 'week' }))
    return rows.map((r) => ({
      id: r.department_id,
      rank: r.rank,
      name: r.name,
      subtitle: `${r.active_members}/${r.members} active · avg per member`,
      points: Math.round(r.avg_points),
      isMe: r.is_mine,
    }))
  }

  // ───── events & check-ins

  async listEvents() {
    const rows = await unwrap(this.sb.rpc('get_events'))
    return rows.map(mapEvent).sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  }

  async getEvent(id: string) {
    const e = (await unwrap(this.sb.rpc('get_events'))).find((x) => x.id === id)
    if (!e) throw new ApiError(FRIENDLY.event_not_found, 'event_not_found')
    return mapEvent(e)
  }

  async joinEvent(id: string) {
    await unwrap(this.sb.rpc('register_event', { p_event_id: id }))
    this.emitTopics('events')
  }

  async checkIn(qrPayload: string): Promise<CheckIn> {
    const me = this.requireUser()
    const [r] = await unwrap(this.sb.rpc('check_in', { p_code: qrPayload.trim() }))
    if (!r) throw new ApiError(FRIENDLY.invalid_checkin_code, 'invalid_checkin_code')
    this.emitTopics('events', 'checkins')
    const profile = await this.getMe()
    return {
      id: checkInId(r.event_id, me),
      eventId: r.event_id,
      eventTitle: r.title,
      userId: me,
      userName: profile.displayName,
      departmentName: profile.departmentName,
      status: checkInStatus(r.status),
      scannedAt: new Date().toISOString(),
      decidedAt: null,
    }
  }

  async listMyCheckIns(): Promise<CheckIn[]> {
    const me = this.requireUser()
    const [profile, rows] = await Promise.all([
      this.getMe(),
      unwrap(
        this.sb
          .from('event_participants')
          .select('event_id,status,checked_in_at,verified_at,events(title)')
          .eq('user_id', me)
          .neq('status', 'registered')
          .order('checked_in_at', { ascending: false }),
      ),
    ])
    return rows.map((r) => ({
      id: checkInId(r.event_id, me),
      eventId: r.event_id,
      eventTitle: (r.events as { title: string } | null)?.title ?? 'Event',
      userId: me,
      userName: profile.displayName,
      departmentName: profile.departmentName,
      status: checkInStatus(r.status),
      scannedAt: r.checked_in_at ?? new Date().toISOString(),
      decidedAt: r.verified_at,
    }))
  }

  async getEventCheckInCode(eventId: string) {
    const [r] = await unwrap(this.sb.rpc('get_event_checkin', { p_event_id: eventId }))
    if (!r) throw new ApiError(FRIENDLY.not_event_organiser, 'not_event_organiser')
    return { payload: r.qr_payload, code: r.code }
  }

  async listEventCheckIns(eventId: string): Promise<CheckIn[]> {
    const [rows, depts, event] = await Promise.all([
      unwrap(this.sb.rpc('get_event_participants', { p_event_id: eventId })),
      this.deptNames(),
      this.getEvent(eventId).catch(() => null),
    ])
    return rows
      .filter((r) => r.status !== 'registered')
      .map((r) => ({
        id: checkInId(eventId, r.user_id),
        eventId,
        eventTitle: event?.title ?? '',
        userId: r.user_id,
        userName: r.display_name,
        departmentName: (r.department_id && depts.get(r.department_id)) || '',
        status: checkInStatus(r.status),
        scannedAt: r.checked_in_at ?? r.registered_at,
        decidedAt: r.verified_at ?? null,
      }))
  }

  async decideCheckIn(id: string, decision: 'verified' | 'rejected') {
    const [eventId, userId] = id.split(':')
    await unwrap(
      this.sb.rpc('verify_participant', { p_event_id: eventId, p_user_id: userId, p_approve: decision === 'verified' }),
    )
    this.emitTopics('checkins', 'events')
  }

  // ───── badges & rewards

  async listBadges(): Promise<Badge[]> {
    const rows = await unwrap(this.sb.rpc('get_badges'))
    for (const b of rows) this.badgeNames.set(b.id, b.name)
    return rows.map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      category: null,
      earnedAt: b.earned ? (b.awarded_at ?? new Date().toISOString()) : null,
    }))
  }

  /**
   * `canRedeem` is a display hint (spendable vs cost, stock). The backend's
   * redeem_reward is what actually enforces it.
   */
  async listRewards(): Promise<Reward[]> {
    const [h, rows] = await Promise.all([
      this.home(),
      unwrap(this.sb.from('rewards').select('*').eq('active', true).order('sort')),
    ])
    return rows.map((r) => {
      const blockedReason =
        r.stock !== null && r.stock <= 0
          ? 'Out of stock'
          : h.points.spendable < r.cost
            ? `${r.cost - h.points.spendable} more MovePoints needed`
            : null
      return { id: r.id, title: r.title, description: r.description, cost: r.cost, canRedeem: !blockedReason, blockedReason }
    })
  }

  async redeemReward(rewardId: string): Promise<Redemption> {
    const r = await unwrap(this.sb.rpc('redeem_reward', { p_reward_id: rewardId }))
    this.emitTopics('rewards', 'profile')
    const title = (await unwrap(this.sb.from('rewards').select('title').eq('id', rewardId).single())).title
    this.notice({ title: 'Reward redeemed', body: title, points: -r.cost, tone: 'ember' })
    return { id: r.id, rewardTitle: title, status: r.status === 'fulfilled' ? 'fulfilled' : 'requested', code: r.code, createdAt: r.created_at }
  }

  async listRedemptions(): Promise<Redemption[]> {
    const rows = await unwrap(
      this.sb.from('redemptions').select('id,status,code,created_at,rewards(title)').neq('status', 'cancelled').order('created_at', { ascending: false }),
    )
    return rows.map((r) => ({
      id: r.id,
      rewardTitle: (r.rewards as { title: string } | null)?.title ?? 'Reward',
      status: r.status === 'fulfilled' ? 'fulfilled' : 'requested',
      code: r.code,
      createdAt: r.created_at,
    }))
  }
}
