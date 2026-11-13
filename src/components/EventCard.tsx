import { Clock, MapPin, Users } from 'lucide-react'
import type { CampusEvent, MyEventStatus, SportKind } from '../api/types'
import { formatEventTime } from '../lib/format'
import { Button, Chip, type Tone } from './ui/ui'
import s from './EventCard.module.css'

const SPORT: Record<SportKind, string> = {
  futsal: 'Futsal',
  pickleball: 'Pickleball',
  badminton: 'Badminton',
  other: 'Organised',
}

const STATUS: Record<Exclude<MyEventStatus, 'none'>, [Tone, string]> = {
  joined: ['neutral', 'Registered'],
  pending: ['ember', 'Pending verification'],
  verified: ['ice', 'Verified'],
  rejected: ['danger', 'Not approved'],
}

/** "Tonight" reads better than "Today" for evening fixtures. Display only. */
function dayLabel(day: string, startIso: string) {
  return day === 'Today' && new Date(startIso).getHours() >= 17 ? 'Tonight' : day
}

export function EventCard({ e, onJoin, busy }: { e: CampusEvent; onJoin?: () => void; busy?: boolean }) {
  const t = formatEventTime(e.startsAt, e.endsAt)
  const full = e.capacity !== null && e.joinedCount >= e.capacity
  const fill = e.capacity ? Math.min(1, e.joinedCount / e.capacity) : 0
  return (
    <article className={s.card}>
      <div className={s.top}>
        <span className="label">{SPORT[e.sport]}</span>
        {e.myStatus !== 'none' ? (
          <Chip tone={STATUS[e.myStatus][0]} dot>
            {STATUS[e.myStatus][1]}
          </Chip>
        ) : (
          <span className={s.reward}>+{e.pointsOnVerify} on verify</span>
        )}
      </div>

      <h3 className={s.title}>{e.title}</h3>

      <div className={s.lines}>
        <div className={s.line}>
          <Clock size={13} />
          <span>
            <strong>{dayLabel(t.day, e.startsAt)}</strong> · {t.date} · {t.time}
          </span>
        </div>
        <div className={s.line}>
          <MapPin size={13} />
          <span>{e.venue}</span>
        </div>
      </div>

      <div className={s.foot}>
        <div className={s.capacity}>
          <Users size={13} />
          <span className="num">
            {e.joinedCount}
            {e.capacity !== null ? <span className={s.capOf}>/{e.capacity}</span> : <span className={s.capOf}> going</span>}
          </span>
          {e.capacity !== null && (
            <span className={s.capBar}>
              <span style={{ width: `${fill * 100}%` }} />
            </span>
          )}
        </div>
        {e.myStatus === 'none'
          ? onJoin && (
              <Button size="sm" variant={full ? 'secondary' : 'primary'} onClick={onJoin} disabled={busy || full} loading={busy}>
                {full ? 'Full' : 'Join'}
              </Button>
            )
          : e.myStatus !== 'joined' && <span className={s.reward}>+{e.pointsOnVerify} on verify</span>}
      </div>
    </article>
  )
}
