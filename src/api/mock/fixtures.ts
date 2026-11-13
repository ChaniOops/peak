/**
 * Seed data for the in-memory mock backend. Purely illustrative campus data.
 */
import type { Badge, CheckIn, FeedItem, Redemption, SportKind, TrackedActivityType } from '../types'
import { dayKey, startOfWeek } from '../../lib/dates'

export const SUMMIT_TARGET_STEPS = 53_000

export interface MockUser {
  id: string
  name: string
  departmentId: string
  role: 'student' | 'organiser'
  weekPoints: number
  weekSteps: number
}

export interface MockDay {
  steps: number
  distanceM: number
  activeMin: number
  points: number
}

export interface MockEvent {
  id: string
  title: string
  sport: SportKind
  venue: string
  startsAt: string
  endsAt: string
  organiserName: string
  capacity: number
  pointsOnVerify: number
  qrToken: string
  joined: string[]
}

export interface MockChallenge {
  id: string
  title: string
  description: string
  scope: 'individual' | 'department'
  unit: string
  progress: number
  target: number
  rewardPoints: number
  endsAt: string
  joined: boolean
  /** what feeds progress inside the mock */
  driver: 'deptDistanceKm' | 'sessions' | 'weekSteps' | 'verifiedSports'
  completed: boolean
}

export interface MockActivity {
  id: string
  type: TrackedActivityType
  startedAt: string
  endedAt: string
  durationSec: number
  steps: number | null
  distanceM: number
  route: { lat: number; lng: number; t: number; accuracy?: number }[]
  sources: { motion: boolean; gps: boolean; simulated: boolean }
  pointsAwarded: number
}

export interface MockReward {
  id: string
  title: string
  description: string
  cost: number
  stock: number
}

export interface MockDb {
  version: number
  signedIn: boolean
  meId: string
  movePoints: number
  departments: { id: string; name: string }[]
  users: MockUser[]
  days: Record<string, MockDay>
  activities: MockActivity[]
  events: MockEvent[]
  checkIns: CheckIn[]
  challenges: MockChallenge[]
  badges: Badge[]
  rewards: MockReward[]
  redemptions: Redemption[]
  feed: FeedItem[]
}

export const DB_VERSION = 3

const DEPARTMENTS = [
  { id: 'cse', name: 'Computer Science' },
  { id: 'ece', name: 'Electronics' },
  { id: 'mech', name: 'Mechanical' },
  { id: 'civil', name: 'Civil' },
  { id: 'des', name: 'Design' },
  { id: 'mgmt', name: 'Management' },
]

const ME_ID = 'u-me'

const CLASSMATES: Array<[string, string]> = [
  ['Riya Baruah', 'cse'],
  ['Arjun Kalita', 'mech'],
  ['Meera Nair', 'des'],
  ['Kabir Sharma', 'ece'],
  ['Tanvi Gogoi', 'civil'],
  ['Dev Hazarika', 'cse'],
  ['Ishita Bora', 'mgmt'],
  ['Rohan Das', 'ece'],
  ['Naina Saikia', 'mech'],
  ['Aditya Rao', 'civil'],
  ['Zoya Ahmed', 'des'],
  ['Pranav Iyer', 'mgmt'],
  ['Sana Choudhury', 'cse'],
  ['Vikram Deka', 'mech'],
]

const BADGES: Omit<Badge, 'earnedAt'>[] = [
  { id: 'b-first', name: 'First Steps', description: 'Log your first tracked activity', category: 'participation' },
  { id: 'b-streak3', name: 'Three-Day Line', description: 'Move three days in a row', category: 'consistency' },
  { id: 'b-summit', name: 'Summit Week', description: 'Reach the weekly summit', category: 'performance' },
  { id: 'b-court', name: 'On the Court', description: 'Get a verified sports check-in', category: 'participation' },
  { id: 'b-pb', name: 'New Ground', description: 'Beat your longest distance', category: 'improvement' },
  { id: 'b-dept', name: 'Rope Team', description: 'Your department completes a challenge', category: 'team' },
]

const REWARDS: MockReward[] = [
  { id: 'r-chai', title: 'Canteen chai + snack', description: 'Redeem at the main canteen counter', cost: 150, stock: 40 },
  { id: 'r-court', title: 'Priority court booking', description: 'Book a badminton court 48h ahead', cost: 300, stock: 15 },
  { id: 'r-gym', title: 'Gym day pass', description: 'One day at the campus fitness centre', cost: 500, stock: 20 },
  { id: 'r-tee', title: 'Peak summit tee', description: 'Limited run, collect from sports office', cost: 1200, stock: 8 },
]

/** Deterministic pseudo-random so seeds look the same on every reset. */
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

function at(base: Date, dayOffset: number, hour: number, minute = 0) {
  const d = new Date(base)
  d.setDate(d.getDate() + dayOffset)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

export function seedDb(now = new Date()): MockDb {
  const rand = rng(42)
  const weekStart = startOfWeek(now)

  // My last 14 days. This week's total lands on 41,260 to mirror the spec example.
  const days: Record<string, MockDay> = {}
  let weekSoFar = 0
  for (let i = 13; i >= 1; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const rest = i === 6 || i === 10 // a couple of rest days so the streak looks honest
    const steps = rest ? Math.round(1800 + rand() * 900) : Math.round(7200 + rand() * 4200)
    const distanceM = Math.round(steps * 0.74)
    days[dayKey(d)] = { steps, distanceM, activeMin: Math.round(steps / 110), points: Math.round(steps / 100) }
    if (d >= weekStart) weekSoFar += steps
  }
  const todaySteps = Math.max(2400, 41_260 - weekSoFar)
  days[dayKey(now)] = {
    steps: todaySteps,
    distanceM: Math.round(todaySteps * 0.74),
    activeMin: Math.round(todaySteps / 110),
    points: Math.round(todaySteps / 100),
  }

  const users: MockUser[] = [
    { id: ME_ID, name: 'Ananya Das', departmentId: 'cse', role: 'student', weekPoints: 0, weekSteps: 0 },
    ...CLASSMATES.map(([name, departmentId], i) => ({
      id: `u-${i}`,
      name,
      departmentId,
      role: 'student' as const,
      weekPoints: Math.round(180 + rand() * 360),
      weekSteps: Math.round(22_000 + rand() * 40_000),
    })),
  ]
  const me = users[0]
  me.weekSteps = Object.entries(days)
    .filter(([k]) => k >= dayKey(weekStart))
    .reduce((s, [, d]) => s + d.steps, 0)
  me.weekPoints = Object.entries(days)
    .filter(([k]) => k >= dayKey(weekStart))
    .reduce((s, [, d]) => s + d.points, 0)

  const events: MockEvent[] = [
    {
      id: 'e-futsal',
      title: 'Futsal 5-a-side Night',
      sport: 'futsal',
      venue: 'Indoor Arena · Court A',
      startsAt: at(now, 0, 18, 30),
      endsAt: at(now, 0, 20, 0),
      organiserName: 'Sports Council',
      capacity: 20,
      pointsOnVerify: 40,
      qrToken: 'fx7k2',
      joined: ['u-1', 'u-3', 'u-5', 'u-7', 'u-9', 'u-11', 'u-12'],
    },
    {
      id: 'e-pickle',
      title: 'Pickleball Open Play',
      sport: 'pickleball',
      venue: 'Tennis Courts 2–3',
      startsAt: at(now, 1, 7, 0),
      endsAt: at(now, 1, 8, 30),
      organiserName: 'Racquet Club',
      capacity: 16,
      pointsOnVerify: 30,
      qrToken: 'pk91q',
      joined: ['u-2', 'u-6', 'u-10'],
    },
    {
      id: 'e-badminton',
      title: 'Badminton Doubles Ladder',
      sport: 'badminton',
      venue: 'Sports Complex · Hall 1',
      startsAt: at(now, 2, 17, 0),
      endsAt: at(now, 2, 19, 0),
      organiserName: 'Shuttle Society',
      capacity: 24,
      pointsOnVerify: 35,
      qrToken: 'bd44m',
      joined: ['u-0', 'u-4', 'u-8', 'u-13'],
    },
    {
      id: 'e-sunrise',
      title: 'Sunrise Hill Walk',
      sport: 'other',
      venue: 'Main Gate → View Point',
      startsAt: at(now, 3, 5, 45),
      endsAt: at(now, 3, 7, 0),
      organiserName: 'Outdoors Club',
      capacity: 60,
      pointsOnVerify: 25,
      qrToken: 'sw20h',
      joined: ['u-1', 'u-2', 'u-3', 'u-6', 'u-9', 'u-12', 'u-13'],
    },
  ]

  const endOfWeek = new Date(weekStart)
  endOfWeek.setDate(endOfWeek.getDate() + 7)

  const challenges: MockChallenge[] = [
    {
      id: 'c-dept',
      title: 'Department Distance Duel',
      description: 'Every kilometre anyone in your department logs counts.',
      scope: 'department',
      unit: 'km',
      progress: 286,
      target: 400,
      rewardPoints: 150,
      endsAt: endOfWeek.toISOString(),
      joined: true,
      driver: 'deptDistanceKm',
      completed: false,
    },
    {
      id: 'c-show',
      title: 'Show Up ×3',
      description: 'Three sessions this week: tracked or verified.',
      scope: 'individual',
      unit: 'sessions',
      progress: 1,
      target: 3,
      rewardPoints: 60,
      endsAt: endOfWeek.toISOString(),
      joined: true,
      driver: 'sessions',
      completed: false,
    },
    {
      id: 'c-court',
      title: 'Court Regular',
      description: 'Two verified sports check-ins this week.',
      scope: 'individual',
      unit: 'check-ins',
      progress: 0,
      target: 2,
      rewardPoints: 80,
      endsAt: endOfWeek.toISOString(),
      joined: false,
      driver: 'verifiedSports',
      completed: false,
    },
  ]

  const earned = new Set(['b-streak3'])
  const badges: Badge[] = BADGES.map((b) => ({
    ...b,
    earnedAt: earned.has(b.id) ? at(now, -2, 19) : null,
  }))

  const feed: FeedItem[] = [
    feedItem('Riya Baruah', 'Computer Science', 'activity', 'ran 4.1 km', 49, -14),
    feedItem('Arjun Kalita', 'Mechanical', 'checkin', 'verified at Futsal 5-a-side', 40, -38),
    feedItem('Meera Nair', 'Design', 'badge', 'earned Three-Day Line', null, -55),
    feedItem('Kabir Sharma', 'Electronics', 'activity', 'cycled 11.6 km', 46, -80),
    feedItem('Tanvi Gogoi', 'Civil', 'activity', 'walked 6,420 steps', 64, -120),
  ].map((f, i) => ({ ...f, id: `f-seed-${i}` }))

  return {
    version: DB_VERSION,
    signedIn: true,
    meId: ME_ID,
    movePoints: 1_240,
    departments: DEPARTMENTS,
    users,
    days,
    activities: [],
    events,
    checkIns: [
      seedCheckIn('ci-seed-1', 'u-1', 'Arjun Kalita', 'Mechanical', -6),
      seedCheckIn('ci-seed-2', 'u-3', 'Kabir Sharma', 'Electronics', -3),
    ],
    challenges,
    badges,
    rewards: REWARDS,
    redemptions: [],
    feed,
  }
}

function seedCheckIn(id: string, userId: string, userName: string, departmentName: string, minutesAgo: number): CheckIn {
  return {
    id,
    eventId: 'e-futsal',
    eventTitle: 'Futsal 5-a-side Night',
    userId,
    userName,
    departmentName,
    status: 'pending',
    scannedAt: new Date(Date.now() + minutesAgo * 60_000).toISOString(),
    decidedAt: null,
  }
}

function feedItem(
  actorName: string,
  departmentName: string,
  kind: FeedItem['kind'],
  text: string,
  points: number | null,
  minutesAgo: number,
): FeedItem {
  return {
    id: '',
    kind,
    actorName,
    departmentName,
    text,
    points,
    createdAt: new Date(Date.now() + minutesAgo * 60_000).toISOString(),
  }
}
