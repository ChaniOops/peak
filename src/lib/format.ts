import type { TrackedActivityType } from '../api/types'

const nf = new Intl.NumberFormat('en-IN')

export const formatNumber = (n: number) => nf.format(Math.round(n))
export const formatSteps = formatNumber

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toFixed(m < 10_000 ? 2 : 1)} km`
}

export function formatKm(m: number): string {
  return (m / 1000).toFixed(2)
}

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** min/km for run & walk */
export function formatPace(distanceM: number, sec: number): string {
  if (distanceM < 50 || sec < 10) return '–:––'
  const secPerKm = sec / (distanceM / 1000)
  if (secPerKm > 60 * 60) return '–:––'
  const m = Math.floor(secPerKm / 60)
  const s = String(Math.round(secPerKm % 60)).padStart(2, '0')
  return `${m}:${s}`
}

export function formatSpeed(distanceM: number, sec: number): string {
  if (sec < 5) return '0.0'
  return ((distanceM / sec) * 3.6).toFixed(1)
}

export function activityVerb(t: TrackedActivityType): string {
  return t === 'walk' ? 'walked' : t === 'run' ? 'ran' : 'cycled'
}

export const ACTIVITY_LABEL: Record<TrackedActivityType, string> = {
  walk: 'Walk',
  run: 'Run',
  cycle: 'Cycle',
}

export function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 45) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  if (s < 86400) return `${Math.round(s / 3600)}h ago`
  return `${Math.round(s / 86400)}d ago`
}

export function formatEventTime(startIso: string, endIso: string) {
  const s = new Date(startIso)
  const e = new Date(endIso)
  const today = new Date()
  const tomorrow = new Date()
  tomorrow.setDate(today.getDate() + 1)
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  const day = sameDay(s, today)
    ? 'Today'
    : sameDay(s, tomorrow)
      ? 'Tomorrow'
      : s.toLocaleDateString('en-IN', { weekday: 'short' })
  const t = (d: Date) => d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
  return {
    day,
    date: s.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    time: `${t(s)} – ${t(e)}`,
  }
}
