import { Users, User, Building2, Check } from 'lucide-react'
import type { Challenge } from '../api/types'
import { formatNumber } from '../lib/format'
import { useNow } from '../lib/useNow'
import { AnimatedNumber } from './ui/AnimatedNumber'
import { Button, ProgressBar } from './ui/ui'
import s from './ChallengeRow.module.css'

const SCOPE = {
  individual: { label: 'Solo', Icon: User },
  department: { label: 'Department', Icon: Users },
  campus: { label: 'Campus', Icon: Building2 },
} as const

export function ChallengeRow({ c, onJoin }: { c: Challenge; onJoin?: (id: string) => void }) {
  const done = c.progress >= c.target
  const now = useNow(60_000)
  const daysLeft = Math.max(0, Math.ceil((new Date(c.endsAt).getTime() - now) / 86_400_000))
  const { label, Icon } = SCOPE[c.scope]
  const pct = Math.min(100, Math.round((c.progress / Math.max(1, c.target)) * 100))
  return (
    <article className={s.row}>
      <div className={s.top}>
        <span className={s.scope}>
          <Icon size={12} /> {label}
        </span>
        <span className="label">{done ? 'Complete' : `${daysLeft}d left`}</span>
        <span className={s.reward}>+{c.rewardPoints}</span>
      </div>
      <h3 className={s.title}>{c.title}</h3>
      <p className={s.desc}>{c.description}</p>
      {c.joined ? (
        <div className={s.progressBlock}>
          <div className={s.progress}>
            <span>
              <span className={`num ${s.progressValue}`}>
                <AnimatedNumber value={c.progress} />
              </span>
              <span className={s.progressTarget}>
                {' '}
                / {formatNumber(c.target)} {c.unit}
              </span>
            </span>
            {done ? (
              <span className={s.done}>
                <Check size={12} strokeWidth={2.6} /> Done
              </span>
            ) : (
              <span className={`num ${s.pct}`}>{pct}%</span>
            )}
          </div>
          <ProgressBar value={c.progress / c.target} tone={done ? 'ice' : 'accent'} />
        </div>
      ) : (
        onJoin && (
          <Button size="sm" variant="secondary" className={s.join} onClick={() => onJoin(c.id)}>
            Join challenge
          </Button>
        )
      )}
    </article>
  )
}
