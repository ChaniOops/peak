import { Users, User } from 'lucide-react'
import type { Challenge } from '../api/types'
import { formatNumber } from '../lib/format'
import { useNow } from '../lib/useNow'
import { Button, ProgressBar } from './ui/ui'
import s from './ChallengeRow.module.css'

export function ChallengeRow({ c, onJoin }: { c: Challenge; onJoin?: (id: string) => void }) {
  const done = c.progress >= c.target
  const now = useNow(60_000)
  const daysLeft = Math.max(0, Math.ceil((new Date(c.endsAt).getTime() - now) / 86_400_000))
  return (
    <div className={s.row}>
      <div className={s.top}>
        <span className={s.scope}>
          {c.scope === 'department' ? <Users size={13} /> : <User size={13} />}
          {c.scope === 'department' ? 'Team' : 'Solo'}
        </span>
        <span className="label">
          {done ? 'Complete' : `${daysLeft}d left`} · +{c.rewardPoints}
        </span>
      </div>
      <div className={s.title}>{c.title}</div>
      <div className={s.desc}>{c.description}</div>
      {c.joined ? (
        <>
          <ProgressBar value={c.progress / c.target} tone={done ? 'ice' : 'accent'} />
          <div className={s.progress}>
            <span className="num">{formatNumber(c.progress)}</span>
            <span className="muted">
              {' '}
              / {formatNumber(c.target)} {c.unit}
            </span>
          </div>
        </>
      ) : (
        onJoin && (
          <Button size="sm" variant="secondary" onClick={() => onJoin(c.id)}>
            Join challenge
          </Button>
        )
      )}
    </div>
  )
}
