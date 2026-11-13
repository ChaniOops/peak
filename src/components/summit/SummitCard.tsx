import { useEffect } from 'react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'
import { Flag } from 'lucide-react'
import type { SummitProgress } from '../../api/types'
import { formatNumber } from '../../lib/format'
import { useNow } from '../../lib/useNow'
import { TopoLines } from '../topo/TopoLines'
import s from './summit.module.css'

/**
 * Weekly step journey drawn as an Everest route.
 * A motivational metaphor: the marker moves along the route by
 * steps / targetSteps. No altitude is implied or shown.
 */

// Switchback route in a 360×240 viewBox, base camp → summit.
const ROUTE: Array<[number, number]> = [
  [34, 222], [128, 210], [86, 190], [176, 172], [132, 150], [206, 132],
  [178, 110], [226, 92], [214, 72], [244, 54], [252, 36],
]
const CAMPS = [
  { f: 0, name: 'Base' },
  { f: 0.25, name: 'Camp I' },
  { f: 0.5, name: 'Camp II' },
  { f: 0.75, name: 'Camp III' },
  { f: 1, name: 'Summit' },
]

const SEGMENTS = ROUTE.slice(1).map((b, i) => {
  const a = ROUTE[i]
  return { a, b, len: Math.hypot(b[0] - a[0], b[1] - a[1]) }
})
const TOTAL = SEGMENTS.reduce((t, x) => t + x.len, 0)
const ROUTE_D = 'M' + ROUTE.map((p) => p.join(',')).join(' L')

function pointAt(f: number): [number, number] {
  let d = Math.max(0, Math.min(1, f)) * TOTAL
  for (const seg of SEGMENTS) {
    if (d <= seg.len) {
      const t = d / seg.len
      return [seg.a[0] + (seg.b[0] - seg.a[0]) * t, seg.a[1] + (seg.b[1] - seg.a[1]) * t]
    }
    d -= seg.len
  }
  return ROUTE[ROUTE.length - 1]
}

const RIDGE_BACK =
  'M0,240 L0,150 L36,128 L70,140 L112,96 L146,112 L178,76 L204,88 L232,58 L262,74 L292,52 L326,88 L360,80 L360,240 Z'
const MASSIF =
  'M0,240 L0,200 L44,182 L84,188 L122,152 L150,160 L188,112 L212,120 L252,30 L276,66 L298,58 L332,112 L360,122 L360,240 Z'
const SNOW = 'M252,30 L236,62 L245,57 L251,68 L259,55 L268,63 L276,66 Z'

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

  const reduce = useReducedMotion()
  const prog = useMotionValue(0)
  useEffect(() => {
    const target = Math.min(1, ratio)
    if (reduce) {
      prog.set(target)
      return
    }
    const c = animate(prog, target, { duration: 1.6, ease: [0.22, 1, 0.36, 1], delay: 0.15 })
    return () => c.stop()
  }, [ratio, prog, reduce])

  const mx = useTransform(prog, (p) => pointAt(p)[0])
  const my = useTransform(prog, (p) => pointAt(p)[1])

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

      <div className={s.scene}>
        <TopoLines className={s.topo} seed={11} rings={compact ? 7 : 10} cx={252} cy={60} />
        <svg viewBox="0 0 360 240" className={s.svg} role="img" aria-label={`${pct}% of the way to the weekly summit`}>
          <defs>
            <linearGradient id="massif" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#252b28" />
              <stop offset="1" stopColor="#111413" />
            </linearGradient>
            <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0.6" stopColor="#111413" stopOpacity="0" />
              <stop offset="1" stopColor="#111413" stopOpacity="1" />
            </linearGradient>
          </defs>
          <path d={RIDGE_BACK} fill="#161a18" />
          <path d={MASSIF} fill="url(#massif)" stroke="rgba(226,233,228,0.10)" strokeWidth={1} />
          <path d={SNOW} fill="#e9eee9" opacity={0.85} />
          <rect x="0" y="0" width="360" height="240" fill="url(#fade)" />

          {/* full route, remaining part dashed */}
          <path
            d={ROUTE_D}
            fill="none"
            stroke="rgba(233,238,233,0.32)"
            strokeWidth={1.6}
            strokeDasharray="3 4"
            strokeLinejoin="round"
          />
          {/* completed part */}
          <motion.path
            d={ROUTE_D}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{ pathLength: prog }}
          />

          {CAMPS.map((c) => {
            const [x, y] = pointAt(c.f)
            const passed = ratio >= c.f
            const isSummit = c.f === 1
            return (
              <g key={c.name}>
                <circle
                  cx={x}
                  cy={y}
                  r={isSummit ? 4.5 : 3.2}
                  fill={passed ? 'var(--accent)' : '#111413'}
                  stroke={passed ? 'var(--accent)' : 'rgba(233,238,233,0.55)'}
                  strokeWidth={1.4}
                />
                {(!compact || isSummit) && (
                  <text
                    x={isSummit ? x + 9 : x + 8}
                    y={isSummit ? y - 4 : y + 3}
                    className={`${s.campLabel} ${passed ? s.campPassed : ''}`}
                  >
                    {c.name.toUpperCase()}
                    {!compact && !isSummit && c.f > 0 && ` · ${formatNumber(c.f * summit.targetSteps)}`}
                  </text>
                )}
              </g>
            )
          })}

          {reached && (
            <motion.g
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 1.5, type: 'spring', stiffness: 400, damping: 18 }}
              style={{ originX: '252px', originY: '36px' }}
            >
              <line x1={252} y1={36} x2={252} y2={14} stroke="var(--text)" strokeWidth={1.5} />
              <path d="M252,14 L268,19 L252,24 Z" fill="var(--accent)" />
            </motion.g>
          )}

          {/* you */}
          <motion.g style={{ x: mx, y: my }}>
            <circle r={13} fill="var(--accent)" opacity={0.16} className={s.halo} />
            <circle r={6.5} fill="var(--accent)" stroke="#0a0c0b" strokeWidth={2.5} />
          </motion.g>
        </svg>
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
