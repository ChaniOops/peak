import { Bar, BarChart, Cell, ReferenceLine, Rectangle, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import type { DailyStat } from '../../api/types'
import { formatDistance, formatNumber } from '../../lib/format'
import s from './WeeklyChart.module.css'

const OTHER = '#24343b' // dark teal-grey: the week, quietly
const ACTIVE = '#3b5560'

/**
 * One question: how does today compare with my week? Seven bars, today in
 * celadon glass, a dashed average for the comparison, nothing else. Touch or
 * hover lights a bar and shows its day.
 */
export function WeeklyChart({ days }: { days: DailyStat[] }) {
  const data = days.map((d, i) => ({
    ...d,
    label: i === days.length - 1 ? 'Today' : new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short' }),
    isToday: i === days.length - 1,
  }))
  const total = days.reduce((t, d) => t + d.steps, 0)
  const avg = total / Math.max(1, days.length)

  return (
    <div className={s.wrap}>
      <div className={s.head}>
        <div>
          <div className="label">Steps, last 7 days</div>
          <div className={`num ${s.total}`}>{formatNumber(total)}</div>
        </div>
        <div className={s.avg}>
          <span className="num">{formatNumber(avg)}</span>
          <span className={`label ${s.avgLabel}`}>
            <i aria-hidden /> Average / day
          </span>
        </div>
      </div>
      <div className={s.chart}>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }} barCategoryGap={6}>
            <defs>
              <linearGradient id="pk-today" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#c9f5ea" />
                <stop offset="0.35" stopColor="#6fdcc8" />
                <stop offset="1" stopColor="#1f8f80" />
              </linearGradient>
            </defs>
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
                    fill={today ? '#e6f7f4' : '#5f6a6d'}
                  >
                    {payload.value}
                  </text>
                )
              }}
            />
            <ReferenceLine y={avg} stroke="rgba(214,240,238,0.28)" strokeDasharray="3 4" ifOverflow="extendDomain" />
            <Tooltip
              cursor={false}
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
            <Bar
              dataKey="steps"
              radius={[6, 6, 2, 2]}
              isAnimationActive
              animationDuration={650}
              animationEasing="ease-out"
              activeBar={(props: unknown) => {
                const p = props as { payload: (typeof data)[number] } & Record<string, unknown>
                return <Rectangle {...p} fill={p.payload.isToday ? 'url(#pk-today)' : ACTIVE} />
              }}
            >
              {data.map((d) => (
                <Cell key={d.date} fill={d.isToday ? 'url(#pk-today)' : OTHER} />
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
