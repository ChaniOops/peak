import { Check } from 'lucide-react'
import type { Challenge } from '../api/types'
import { formatNumber } from '../lib/format'
import { useNow } from '../lib/useNow'
import { RollingNumber } from './ui/RollingNumber'
import { BlurReplace } from './ui/BlurReplace'
import { Button, ProgressBar } from './ui/ui'
import s from './ChallengeRow.module.css'

const SCOPE = { individual: 'Solo', department: 'Department', campus: 'Campus' } as const

export function ChallengeRow({ c, onJoin }: { c: Challenge; onJoin?: (id: string) => void }) {
  const done = c.progress >= c.target
  const now = useNow(60_000)
  const daysLeft = Math.max(0, Math.ceil((new Date(c.endsAt).getTime() - now) / 86_400_000))
  const label = SCOPE[c.scope]
  return (
    <article className={s.row}>
      <div className={s.top}>
        <span className={s.scope}>{label}</span>
        <span className="label">{done ? 'Complete' : `${daysLeft}d left`}</span>
        {/* the reward is the incentive: Peak's yellow tag */}
        <span className={`tag tag-yellow ${s.reward}`}>+{c.rewardPoints}</span>
      </div>
      <h3 className={s.title}>{c.title}</h3>
      <p className={s.desc}>{c.description}</p>
      {c.joined ? (
        <div className={s.progressBlock}>
          <div className={s.progress}>
            <span>
              <span className={`num ${s.progressValue}`}>
                <RollingNumber value={c.progress} />
              </span>
              <span className={s.progressTarget}>
                {' '}
                / {formatNumber(c.target)} {c.unit}
              </span>
            </span>
            <BlurReplace id={done ? 'done' : 'left'} origin="right center">
              {done ? (
                <span className="tag tag-yellow">
                  <Check size={11} strokeWidth={3} /> Completed
                </span>
              ) : (
                <span className={s.toGo}>
                  {formatNumber(Math.max(0, c.target - c.progress))} {c.unit} to go
                </span>
              )}
            </BlurReplace>
          </div>
          <ProgressBar value={c.progress / c.target} tone={done ? 'complete' : 'progress'} />
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
