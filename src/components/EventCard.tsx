import { MapPin, Users } from 'lucide-react'
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
  joined: ['neutral', 'Going'],
  pending: ['ember', 'Awaiting organiser'],
  verified: ['ice', 'Verified'],
  rejected: ['danger', 'Not approved'],
}

export function EventCard({ e, onJoin, busy }: { e: CampusEvent; onJoin?: () => void; busy?: boolean }) {
  const t = formatEventTime(e.startsAt, e.endsAt)
  const full = e.capacity !== null && e.joinedCount >= e.capacity
  return (
    <article className={s.card}>
      <div className={s.when}>
        <span className={s.day}>{t.day}</span>
        <span className={`num ${s.date}`}>{t.date}</span>
      </div>
      <div className={s.main}>
        <div className={s.meta}>
          <span className="label">{SPORT[e.sport]}</span>
          <span className={s.reward}>+{e.pointsOnVerify} verified</span>
        </div>
        <h3 className={s.title}>{e.title}</h3>
        <div className={s.line}>{t.time}</div>
        <div className={s.line}>
          <MapPin size={13} /> {e.venue}
        </div>
        <div className={s.foot}>
          <div className={s.capacity}>
            <Users size={13} />
            <span>
              {e.joinedCount}
              {e.capacity !== null ? `/${e.capacity}` : ' going'}
            </span>
            {e.capacity !== null && (
              <span className={s.capBar}>
                <span style={{ width: `${Math.min(1, e.joinedCount / e.capacity) * 100}%` }} />
              </span>
            )}
          </div>
          {e.myStatus === 'none' ? (
            onJoin && (
              <Button size="sm" onClick={onJoin} disabled={busy || full}>
                {full ? 'Full' : 'Join'}
              </Button>
            )
          ) : (
            <Chip tone={STATUS[e.myStatus][0]} dot>
              {STATUS[e.myStatus][1]}
            </Chip>
          )}
        </div>
      </div>
    </article>
  )
}
