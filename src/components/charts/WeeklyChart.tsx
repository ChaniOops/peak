import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import type { DailyStat } from '../../api/types'
import { formatDistance, formatNumber } from '../../lib/format'
import s from './WeeklyChart.module.css'

const WEEK = '#2b2b2b'
const WEEK_HOT = '#4a4a4a'
const YELLOW = '#ffd23f' // --pk-yellow: today
const PINK = '#ff9dc6' // --pk-pink: best day

type Datum = DailyStat & { label: string; isToday: boolean; isBest: boolean }
type BarShape = { x: number; y: number; width: number; height: number; payload: Datum; fill?: string }

/** chunky bar, square-ish top: Peak's poster geometry */
function block({ x, y, width, height }: BarShape, fill: string, lift = 0, outline = false) {
  // a zero day still shows its slot: a 2px stub on the baseline
  if (height <= 0) return <rect x={x} y={y - 2} width={width} height={2} fill={fill} />
  const r = 3
  const top = y - lift
  const d = `M${x},${top + height} V${top + r} Q${x},${top} ${x + r},${top} H${x + width - r} Q${x + width},${top} ${x + width},${top + r} V${top + height} Z`
  return <path d={d} fill={fill} stroke={outline ? '#ffffff' : 'none'} strokeWidth={outline ? 1.5 : 0} />
}

/**
 * Movement: one question — how does today compare with my week? Seven chunky
 * bars on black. Today is a flat yellow block, the best day a flat pink one
 * with a tiny tag; everything else is quiet charcoal. Touch or hover pops a
 * bar forward and shows a small black-glass tooltip.
 */
export function WeeklyChart({ days }: { days: DailyStat[] }) {
  const lastIdx = days.length - 1
  const bestIdx = days.reduce((b, d, i) => (i !== lastIdx && d.steps > (days[b]?.steps ?? -1) ? i : b), lastIdx === 0 ? -1 : 0)
  const data: Datum[] = days.map((d, i) => ({
    ...d,
    label: i === lastIdx ? 'Today' : new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short' }),
    isToday: i === lastIdx,
    isBest: i === bestIdx && d.steps > 0 && i !== lastIdx,
  }))
  const total = days.reduce((t, d) => t + d.steps, 0)
  const avg = total / Math.max(1, days.length)
  const colour = (d: Datum) => (d.isToday ? YELLOW : d.isBest ? PINK : WEEK)

  return (
    <div className={s.wrap}>
      <div className={s.head}>
        <div>
          <div className="label">Steps, last 7 days</div>
          <div className={`num ${s.total}`}>{formatNumber(total)}</div>
        </div>
        <div className={s.legend} aria-hidden>
          <span>
            <i className={s.keyToday} /> Today
          </span>
          {bestIdx >= 0 && data[bestIdx]?.isBest && (
            <span>
              <i className={s.keyBest} /> Best
            </span>
          )}
          {avg > 0 && (
            <span>
              <i className={s.keyAvg} /> Avg
            </span>
          )}
        </div>
      </div>
      <div className={s.chart}>
        <ResponsiveContainer width="100%" height={168}>
          <BarChart data={data} margin={{ top: 22, right: avg > 0 ? 50 : 4, bottom: 0, left: 4 }} barCategoryGap={5}>
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              interval={0}
              tick={({ x, y, payload }) => {
                const today = payload.value === 'Today'
                return (
                  <text
                    x={x}
                    y={Number(y) + 10}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={today ? 600 : 450}
                    fontFamily="Geist, system-ui, sans-serif"
                    fill={today ? '#eeeeee' : '#666666'}
                  >
                    {payload.value}
                  </text>
                )
              }}
            />
            {avg > 0 && (
              <ReferenceLine
                y={avg}
                stroke="rgba(255,255,255,0.28)"
                strokeDasharray="2 4"
                ifOverflow="extendDomain"
                label={({ viewBox }: { viewBox?: { x: number; y: number; width: number } }) => {
                  if (!viewBox) return <g />
                  // the average hangs off the end of its line, outside the bars
                  const text = formatNumber(avg)
                  const w = Math.max(38, text.length * 6.4 + 10)
                  const x = viewBox.x + viewBox.width + 6
                  return (
                    <g transform={`translate(${x}, ${viewBox.y - 9})`}>
                      <rect width={w} height={17} rx={2} fill="#eeeeee" />
                      <text x={w / 2} y={12} textAnchor="middle" fontSize={10.5} fontWeight={600} fontFamily="Space Grotesk, Geist, sans-serif" fill="#0a0a0a">
                        {text}
                      </text>
                    </g>
                  )
                }}
              />
            )}
            <Tooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload as Datum
                return (
                  <div className={s.tip}>
                    <div className="label">
                      {new Date(d.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
                    </div>
                    <div className={`num ${s.tipValue}`}>{formatNumber(d.steps)} steps</div>
                    <div className={s.tipSub}>{formatDistance(d.distanceM)}</div>
                  </div>
                )
              }}
            />
            <Bar
              dataKey="steps"
              isAnimationActive
              animationDuration={420}
              animationEasing="ease-out"
              shape={(p: unknown) => block(p as BarShape, colour((p as BarShape).payload))}
              activeBar={(p: unknown) => {
                const b = p as BarShape
                const d = b.payload
                return block(b, d.isToday || d.isBest ? colour(d) : WEEK_HOT, 3, true)
              }}
              label={(props: unknown) => {
                const l = props as { x?: number | string; y?: number | string; width?: number | string; index?: number }
                if (l.index === undefined || !data[l.index]?.isBest || l.x === undefined || l.y === undefined || l.width === undefined) return <g />
                const x = Number(l.x)
                const y = Number(l.y)
                const width = Number(l.width)
                return (
                  <g transform={`translate(${x + width / 2}, ${y - 7})`}>
                    <rect x={-15} y={-12} width={30} height={14} rx={2} fill={PINK} />
                    <text y={-2} textAnchor="middle" fontSize={9.5} fontWeight={700} fontFamily="Space Grotesk, Geist, sans-serif" fill="#0a0a0a">
                      Best
                    </text>
                  </g>
                )
              }}
            >
              {data.map((d) => (
                <Cell key={d.date} fill={colour(d)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="visually-hidden">
        <caption>Steps per day, last 7 days</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <th>
                {d.label}
                {d.isBest ? ' (best day)' : ''}
              </th>
              <td>{d.steps}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
