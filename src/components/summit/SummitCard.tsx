import { Flag } from 'lucide-react'
import type { SummitProgress } from '../../api/types'
import { formatNumber } from '../../lib/format'
import { useNow } from '../../lib/useNow'
import { EverestClimb } from './EverestClimb'
import s from './summit.module.css'

/**
 * Weekly step journey drawn as an Everest route.
 * A motivational metaphor: the route head moves by steps / targetSteps.
 * No altitude is implied or shown.
 */

// route fractions; EverestClimb marks the same camps on the route
const CAMPS = [
  { f: 0.25, name: 'Camp I' },
  { f: 0.5, name: 'Camp II' },
  { f: 0.75, name: 'Camp III' },
  { f: 1, name: 'Summit' },
]

export function SummitCard({ summit, compact = false }: { summit: SummitProgress; compact?: boolean }) {
  const ratio = summit.targetSteps > 0 ? summit.steps / summit.targetSteps : 0
  const reached = ratio >= 1
  // round like the spec (41,260 / 53,000 → 78%), but never claim 100% before the summit
  const pct = reached ? 100 : Math.min(99, Math.round(ratio * 100))
  const multiple = Math.floor(ratio * 10) / 10
  const next = CAMPS.find((c) => c.f > ratio)
  const toNext = next ? Math.ceil(next.f * summit.targetSteps - summit.steps) : 0
  const now = useNow(60_000)
  const daysLeft = Math.max(0, Math.ceil((new Date(summit.weekEnd).getTime() - now) / 86_400_000))

  return (
    <div className={`${s.card} ${compact ? s.compact : ''}`}>
      <div className={s.top}>
        <span className="label">{daysLeft} days left this week</span>
        {reached ? (
          <span className={s.reachedTag}>
            <Flag size={12} /> Summit reached
          </span>
        ) : (
          <span className={s.pct}>
            <span className="num">{pct}%</span> to summit
          </span>
        )}
      </div>

      <div className={s.figures}>
        <span className={`num ${s.steps}`}>{formatNumber(summit.steps)}</span>
        <span className={s.target}>/ {formatNumber(summit.targetSteps)} steps</span>
      </div>

      <div className={s.scene} role="img" aria-label={`${pct}% of the way to the weekly summit`}>
        <EverestClimb steps={summit.steps} goalSteps={summit.targetSteps} />
      </div>

      <div className={s.footer}>
        {reached ? (
          <>
            <span className={`num ${s.multiple}`}>{multiple.toFixed(1)}×</span>
            <span className="muted">Everest this week. Every step now counts toward the next lap.</span>
          </>
        ) : next ? (
          <span className="muted">
            <strong className={s.strong}>{formatNumber(toNext)}</strong> steps to {next.name}
          </span>
        ) : null}
      </div>
    </div>
  )
}
