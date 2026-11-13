import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import type { DailyStat } from '../../api/types'
import { formatDistance, formatNumber } from '../../lib/format'
import s from './WeeklyChart.module.css'

const TODAY = '#c8f169'
const OTHER = '#3a3a3a'

/** Single series: steps per day, last 7 days. Today is accented and labelled. */
export function WeeklyChart({ days }: { days: DailyStat[] }) {
  const data = days.map((d, i) => ({
    ...d,
    label: i === days.length - 1 ? 'Today' : new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short' }),
    isToday: i === days.length - 1,
  }))
  const total = days.reduce((t, d) => t + d.steps, 0)

  return (
    <div className={s.wrap}>
      <div className={s.head}>
        <div>
          <div className="label">Steps · last 7 days</div>
          <div className={`num ${s.total}`}>{formatNumber(total)}</div>
        </div>
        <div className={s.avg}>
          <span className="num">{formatNumber(total / Math.max(1, days.length))}</span>
          <span className="label">avg / day</span>
        </div>
      </div>
      <div className={s.chart}>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }} barCategoryGap={6}>
            <XAxis
              dataKey="label"
              axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
              tickLine={false}
              tick={{ fill: '#666666', fontSize: 10, fontFamily: 'Geist Mono, ui-monospace, monospace' }}
              interval={0}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload as (typeof data)[number]
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
            <Bar dataKey="steps" radius={[5, 5, 1, 1]} isAnimationActive animationDuration={700}>
              {data.map((d) => (
                <Cell key={d.date} fill={d.isToday ? TODAY : OTHER} />
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
              <th>{d.label}</th>
              <td>{d.steps}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
