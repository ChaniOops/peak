import type {
  Activity,
  ActivitySaveResult,
  Badge,
  CampusEvent,
  Challenge,
  CheckIn,
  DailyStat,
  EventCheckInCode,
  FeedItem,
  GeoPoint,
  LeaderboardEntry,
  LeaderboardScope,
  LiveActivityHandle,
  LiveTotals,
  RealtimeEvent,
  Redemption,
  Reward,
  StreakDay,
  SummitProgress,
  TodaySummary,
  Topic,
  TrackedActivityType,
  UserProfile,
} from './types'

/**
 * The only surface screens talk to. Implemented by the in-memory mock and by
 * the Supabase translation layer.
 */
export interface Api {
  readonly mode: 'mock' | 'supabase'

  // session
  getSession(): Promise<UserProfile | null>
  /** Seeded demo account. `demoAvailable` says whether this works in the current mode. */
  readonly demoAvailable: boolean
  signInDemo(): Promise<UserProfile>
  signIn(email: string, password: string): Promise<UserProfile>
  signOut(): Promise<void>

  // me
  getMe(): Promise<UserProfile>
  getToday(): Promise<TodaySummary>
  getStreak(): Promise<StreakDay[]>
  getSummit(): Promise<SummitProgress>
  getWeekly(): Promise<DailyStat[]>
  listActivities(limit?: number): Promise<Activity[]>

  // live tracking: start → push cumulative totals every ~5 s → finish | discard
  startActivity(type: TrackedActivityType): Promise<LiveActivityHandle>
  /** `newRoute` = only GPS samples not sent before. Lost/duplicate pushes are harmless. */
  pushActivity(id: string, totals: LiveTotals, newRoute: GeoPoint[]): Promise<void>
  finishActivity(id: string, totals: LiveTotals, newRoute: GeoPoint[]): Promise<ActivitySaveResult>
  discardActivity(id: string): Promise<void>

  // social
  getFeed(limit?: number): Promise<FeedItem[]>
  listChallenges(): Promise<Challenge[]>
  joinChallenge(id: string): Promise<void>
  getLeaderboard(scope: LeaderboardScope): Promise<LeaderboardEntry[]>

  // verified campus activities
  listEvents(): Promise<CampusEvent[]>
  getEvent(id: string): Promise<CampusEvent>
  joinEvent(id: string): Promise<void>
  /** Raw scanned QR text; the backend parses and verifies it. */
  checkIn(qrPayload: string): Promise<CheckIn>
  listMyCheckIns(): Promise<CheckIn[]>

  // organiser (hidden demo route)
  getEventCheckInCode(eventId: string): Promise<EventCheckInCode>
  listEventCheckIns(eventId: string): Promise<CheckIn[]>
  decideCheckIn(checkInId: string, decision: 'verified' | 'rejected'): Promise<void>

  // badges & rewards
  listBadges(): Promise<Badge[]>
  listRewards(): Promise<Reward[]>
  redeemReward(rewardId: string): Promise<Redemption>
  listRedemptions(): Promise<Redemption[]>

  /** Subscribe to realtime topics. Returns an unsubscribe function. */
  subscribe(topics: Array<Topic | 'notice'>, cb: (e: RealtimeEvent) => void): () => void

  /** Mock only: wipe local demo state. */
  resetDemo?(): Promise<void>
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string = 'unknown',
  ) {
    super(message)
  }
}
