/**
 * Supabase translation layer: backend rows/RPCs → frontend domain types.
 *
 * The backend owns the schema. This file adapts to it — never the reverse.
 * Methods are filled in as the backend publishes tables/RPCs; until then the
 * app runs on the mock (see api/index.ts).
 */
import type { Api } from '../client'
import { ApiError } from '../client'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = Boolean(url && anonKey)

const notWired = (what: string) => () =>
  Promise.reject(new ApiError(`${what}: waiting on backend schema`, 'not_wired'))

export class SupabaseApi implements Api {
  readonly mode = 'supabase' as const

  getSession = notWired('getSession')
  signInDemo = notWired('signInDemo')
  signInWithEmail = notWired('signInWithEmail')
  signOut = notWired('signOut')
  getMe = notWired('getMe')
  getToday = notWired('getToday')
  getStreak = notWired('getStreak')
  getSummit = notWired('getSummit')
  getWeekly = notWired('getWeekly')
  listActivities = notWired('listActivities')
  saveActivity = notWired('saveActivity')
  getFeed = notWired('getFeed')
  listChallenges = notWired('listChallenges')
  joinChallenge = notWired('joinChallenge')
  getLeaderboard = notWired('getLeaderboard')
  listEvents = notWired('listEvents')
  getEvent = notWired('getEvent')
  joinEvent = notWired('joinEvent')
  checkIn = notWired('checkIn')
  listMyCheckIns = notWired('listMyCheckIns')
  getEventQrPayload = notWired('getEventQrPayload')
  listEventCheckIns = notWired('listEventCheckIns')
  decideCheckIn = notWired('decideCheckIn')
  listBadges = notWired('listBadges')
  listRewards = notWired('listRewards')
  redeemReward = notWired('redeemReward')
  listRedemptions = notWired('listRedemptions')

  subscribe() {
    return () => {}
  }
}
