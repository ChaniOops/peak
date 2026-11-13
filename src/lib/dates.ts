/** Local-date key, YYYY-MM-DD. */
export function dayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Monday 00:00 local of the week containing d. */
export function startOfWeek(d: Date): Date {
  const s = new Date(d)
  s.setHours(0, 0, 0, 0)
  const dow = (s.getDay() + 6) % 7 // Mon=0
  s.setDate(s.getDate() - dow)
  return s
}

export function lastNDays(n: number, now = new Date()): Date[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - (n - 1 - i))
    return d
  })
}
