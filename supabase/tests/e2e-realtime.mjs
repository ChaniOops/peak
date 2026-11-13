// Realtime/API smoke test of the core chain against a running Supabase (local or hosted):
//   phone (demo) tracks a walk -> laptop (demo, 2nd session) gets it via postgres_changes
//   -> Everest/Home move live -> another student gets the public 'leaderboard' pulse; RLS checks.
//
//   SB_URL=http://127.0.0.1:55321 SB_KEY=<anon/publishable key> node supabase/tests/e2e-realtime.mjs
//
// Default mode is demo-safe: the test walk is DISCARDED (no points kept, seed state intact).
// E2E_FULL=1 also finishes the walk, joins a challenge and signs up a user (re-seed afterwards).
// Needs @supabase/supabase-js resolvable (installed by the app).
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SB_URL ?? 'http://127.0.0.1:55321'
const KEY = process.env.SB_KEY
const pw = 'peak-demo-2026'
const mk = () => createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let failures = 0
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++ }

const phone = mk(), laptop = mk(), other = mk(), anon = mk()
for (const [c, email] of [[phone, 'demo@peak.test'], [laptop, 'demo@peak.test'], [other, 'student05@peak.test']]) {
  const { error } = await c.auth.signInWithPassword({ email, password: pw })
  if (error) throw error
}
for (const c of [laptop, other]) c.realtime.setAuth((await c.auth.getSession()).data.session.access_token)

const demoId = (await phone.auth.getUser()).data.user.id
const liveEvents = [], pulses = []
const ready = (ch) => new Promise((res) => ch.subscribe((s) => s === 'SUBSCRIBED' && res()))
await ready(laptop.channel('my-activity').on('postgres_changes',
  { event: '*', schema: 'public', table: 'activities', filter: `user_id=eq.${demoId}` }, (p) => liveEvents.push(p)))
await ready(other.channel('leaderboard').on('broadcast', { event: 'changed' }, (p) => pulses.push(p)))
// another user must NOT receive demo's activity rows
const leaked = []
await ready(other.channel('snoop').on('postgres_changes', { event: '*', schema: 'public', table: 'activities' }, (p) => leaked.push(p)))
await sleep(500)

const home0 = (await phone.rpc('get_home')).data

const { data: act, error: e1 } = await phone.rpc('start_activity', { p_type: 'walk' })
check(!e1 && act.status === 'live', 'start_activity -> live walk')
await sleep(12000) // ~a 25 m walk: enough wall-clock time for 40 steps under the cadence clamp
const { data: pushed, error: e2 } = await phone.rpc('push_activity', { p_activity_id: act.id, p_steps: 40, p_active_s: 12 })
check(!e2 && pushed.steps === 40, `push_activity accepted cumulative steps (${pushed?.steps})`)
const { data: clamped } = await phone.rpc('push_activity', { p_activity_id: act.id, p_steps: 99999, p_active_s: 5 })
check(clamped.steps < 100, `cadence clamp holds (${clamped.steps} steps after ~13 s)`)
await sleep(1500)

check(liveEvents.length >= 2, `laptop got ${liveEvents.length} realtime activity events`)
check(leaked.length === 0, 'other student received none of demo\'s activity rows')
const home1 = (await laptop.rpc('get_home')).data
check(home1.live_activity?.id === act.id, 'get_home shows live activity on second device')
check(home1.everest.current_steps === home0.everest.current_steps + clamped.steps, `Everest moved live: ${home0.everest.current_steps} -> ${home1.everest.current_steps}`)
check(home0.everest.summit_count === 0 && home1.everest.summit_count === 1, 'seeded demo: a ~40-step walk crosses the summit live')

const { data: other_acts } = await other.from('activities').select('id').eq('user_id', demoId)
check(other_acts.length === 0, 'RLS: other student cannot read demo activities')
const { data: other_pts } = await other.from('activity_points').select('activity_id').limit(1)
check(other_pts.length === 0, 'RLS: other student cannot read GPS points')
const { error: eWrite } = await phone.from('points_ledger').insert({ user_id: demoId, reason: 'event', source_key: 'x', amount: 9999 })
check(!!eWrite, 'RLS: client cannot write ledger directly')
const { error: eAnon } = await anon.rpc('get_home')
check(!!eAnon, 'anon cannot call get_home')
const { data: depts } = await anon.from('departments').select('id')
check(depts.length === 6, 'anon can list departments for sign-up')

await sleep(1500)
check(pulses.length >= 1, `other student received ${pulses.length} leaderboard pulse(s)`)
const { data: challenges } = await phone.rpc('get_challenges')
check(challenges.some((c) => c.joined) && challenges.some((c) => !c.joined), 'get_challenges has joined + joinable')

if (!process.env.E2E_FULL) {
  const { error: eD } = await phone.rpc('discard_activity', { p_activity_id: act.id })
  const home2 = (await phone.rpc('get_home')).data
  check(!eD && home2.live_activity === null && home2.points.week === home0.points.week, 'discarded walk leaves no points behind')
  check(home2.everest.current_steps === home0.everest.current_steps && home2.everest.summit_count === 0, 'discard: Everest back below summit')
  const badges2 = (await phone.rpc('get_badges')).data
  check(!badges2.find((b) => b.id === 'summit').earned, 'discard: no Summit badge')
  const dept2 = (await phone.rpc('get_challenges')).data.find((c) => c.slug === 'dept-step-summit')
  check(!dept2.completed, 'discard: Department Step Summit not completed')
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED (demo-safe mode)')
  process.exit(failures ? 1 : 0)
}

const { data: summary, error: e3 } = await phone.rpc('finish_activity', { p_activity_id: act.id })
check(!e3 && summary.activity.status === 'completed', 'finish_activity returns summary')

const join = await phone.rpc('join_challenge', { p_challenge_id: challenges.find((c) => c.slug === 'five-sessions').id })
check(!join.error && join.data.completed_challenges.length === 1, 'joining five-sessions completes it instantly (+50)')

// sign-up creates a profile with department
const fresh = mk()
const email = `e2e${Date.now()}@peak.test`
const su = await fresh.auth.signUp({ email, password: pw, options: { data: { display_name: 'E2E Tester', department_id: 'me' } } })
const prof = (await fresh.rpc('get_home')).data?.profile
check(!su.error && prof?.department_id === 'me' && prof?.role === 'student', 'sign-up creates student profile in chosen department')

console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED')
process.exit(failures ? 1 : 0)
