/**
 * Frontend DOMAIN types.
 *
 * These describe what the UI needs, not how the backend stores it. The backend
 * owns the canonical Supabase schema; `supabase/supabaseApi.ts` translates
 * backend rows/RPC results into these shapes. Never make the backend conform
 * to this file.
 *
 * Authoritative values (MovePoints, ranks, badge awards, reward eligibility)
 * always arrive from the API. The UI only formats them.
 */

export type ISODate = string

export type TrackedActivityType = 'walk' | 'run' | 'cycle'
export type SportKind = 'futsal' | 'pickleball' | 'badminton' | 'other'

export type UserRole = 'student' | 'organiser'

export interface UserProfile {
  id: string
  displayName: string
  departmentId: string
  departmentName: string
  role: UserRole
  movePoints: number
  streakDays: number
}

export interface GeoPoint {
  lat: number
  lng: number
  /** epoch ms */
  t: number
  accuracy?: number
}

/** Cumulative totals since the session started (the backend expects totals, not deltas). */
export interface LiveTotals {
  steps: number | null
  distanceM: number
  /** moving time, pauses excluded */
  activeSec: number
}

export interface LiveActivityHandle {
  id: string
}

export interface Activity {
  id: string
  type: TrackedActivityType
  startedAt: ISODate
  endedAt: ISODate | null
  durationSec: number
  steps: number | null
  distanceM: number
  pointsAwarded: number
}

export interface ActivitySaveResult {
  activity: Activity
  pointsAwarded: number
  /** display-only breakdown of the API's award, zero lines omitted */
  breakdown: Array<{ label: string; points: number }>
  completedChallenges: string[]
  badgesEarned: Badge[]
}

export interface TodaySummary {
  steps: number
  distanceM: number
  activeMinutes: number
  movePoints: number
}

/** One day of the Kairu-style streak strip, oldest first. */
export interface StreakDay {
  date: ISODate
  active: boolean
}

/** Weekly step journey shown as an Everest route. Target is set by the API (53,000). */
export interface SummitProgress {
  weekStart: ISODate
  weekEnd: ISODate
  steps: number
  targetSteps: number
}

export type ChallengeScope = 'individual' | 'department' | 'campus'

export interface Challenge {
  id: string
  title: string
  description: string
  scope: ChallengeScope
  unit: string
  progress: number
  target: number
  rewardPoints: number
  endsAt: ISODate
  joined: boolean
}

export type LeaderboardScope = 'individual' | 'department'

export interface LeaderboardEntry {
  id: string
  rank: number
  name: string
  subtitle: string
  points: number
  isMe: boolean
}

export type CheckInStatus = 'pending' | 'verified' | 'rejected'
export type MyEventStatus = 'none' | 'joined' | CheckInStatus

export interface CampusEvent {
  id: string
  title: string
  sport: SportKind
  venue: string
  startsAt: ISODate
  endsAt: ISODate
  organiserName: string
  capacity: number | null
  joinedCount: number
  pointsOnVerify: number
  myStatus: MyEventStatus
}

export interface CheckIn {
  id: string
  eventId: string
  eventTitle: string
  userId: string
  userName: string
  departmentName: string
  status: CheckInStatus
  scannedAt: ISODate
  decidedAt: ISODate | null
}

export type BadgeCategory = 'performance' | 'consistency' | 'participation' | 'improvement' | 'team'

export interface Badge {
  id: string
  name: string
  description: string
  category: BadgeCategory | null
  earnedAt: ISODate | null
}

export interface Reward {
  id: string
  title: string
  description: string
  cost: number
  canRedeem: boolean
  /** API-provided reason when canRedeem is false */
  blockedReason: string | null
}

export interface Redemption {
  id: string
  rewardTitle: string
  status: 'requested' | 'fulfilled'
  code: string | null
  createdAt: ISODate
}

export type FeedKind = 'activity' | 'checkin' | 'badge' | 'challenge' | 'redemption'

export interface FeedItem {
  id: string
  kind: FeedKind
  actorName: string
  departmentName: string
  text: string
  points: number | null
  createdAt: ISODate
}

export interface EventCheckInCode {
  /** render this as the QR */
  payload: string
  /** short code people can type */
  code: string
}

export interface DailyStat {
  date: ISODate
  steps: number
  distanceM: number
}

/** Realtime topics. Screens refetch what they show when a topic fires. */
export type Topic =
  | 'profile'
  | 'today'
  | 'summit'
  | 'activities'
  | 'feed'
  | 'challenges'
  | 'leaderboard'
  | 'events'
  | 'checkins'
  | 'badges'
  | 'rewards'

/** Short user-facing notice pushed by the backend (e.g. "+40 MovePoints"). */
export interface Notice {
  id: string
  title: string
  body: string
  points: number | null
  tone: 'accent' | 'ice' | 'ember' | 'danger'
}

export type RealtimeEvent = { topic: Topic } | { topic: 'notice'; notice: Notice }
