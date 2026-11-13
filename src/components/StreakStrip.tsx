import { motion } from 'framer-motion'
import { Flame } from 'lucide-react'
import type { StreakDay } from '../api/types'
import s from './StreakStrip.module.css'

/** Concise 7-day consistency strip. `streakDays` comes from the API. */
export function StreakStrip({ days, streakDays }: { days: StreakDay[]; streakDays: number }) {
  return (
    <div className={s.wrap}>
      <div className={s.head}>
        <Flame size={14} className={streakDays > 0 ? s.flameOn : s.flameOff} />
        <span className={`num ${s.count}`}>{streakDays}</span>
        <span className={s.caption}>day streak</span>
      </div>
      <div className={s.days} aria-label={`${days.filter((d) => d.active).length} active days in the last week`}>
        {days.map((d, i) => {
          const date = new Date(d.date)
          const today = i === days.length - 1
          return (
            <div key={d.date} className={s.day}>
              <motion.span
                className={`${s.mark} ${d.active ? s.on : ''} ${today ? s.today : ''}`}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 + i * 0.035, type: 'spring', stiffness: 500, damping: 30 }}
              />
              <span className={`${s.dow} ${today ? s.dowToday : ''}`}>{date.toLocaleDateString('en-IN', { weekday: 'narrow' })}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
