import { LayoutGroup, motion } from 'framer-motion'
import type { LeaderboardEntry } from '../api/types'
import { formatNumber } from '../lib/format'
import { Avatar } from './ui/Avatar'
import s from './Leaderboard.module.css'

const TOP = 10

/** Ranks and points are rendered exactly as the API returns them. */
export function Leaderboard({ entries, unit }: { entries: LeaderboardEntry[]; unit: string }) {
  const top = entries.slice(0, TOP)
  const me = entries.find((e) => e.isMe)
  const meOutside = me && me.rank > TOP

  return (
    <LayoutGroup>
      <ol className={s.list}>
        {top.map((e) => (
          <Row key={e.id} e={e} unit={unit} />
        ))}
        {meOutside && (
          <>
            <li className={s.gap} aria-hidden>
              ···
            </li>
            <Row e={me} unit={unit} />
          </>
        )}
      </ol>
    </LayoutGroup>
  )
}

function Row({ e, unit }: { e: LeaderboardEntry; unit: string }) {
  return (
    <motion.li
      layout="position"
      transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      className={`${s.row} ${e.isMe ? s.me : ''}`}
    >
      <span className={`num ${s.rank} ${e.rank <= 3 ? s.podium : ''}`}>{e.rank}</span>
      <Avatar name={e.name} size={34} highlight={e.isMe} />
      <div className={s.who}>
        <div className={s.name}>
          {e.name}
          {e.isMe && <span className={s.youTag}>you</span>}
        </div>
        <div className={s.sub}>{e.subtitle}</div>
      </div>
      <div className={s.points}>
        <span className="num">{formatNumber(e.points)}</span>
        <span className={s.unit}>{unit}</span>
      </div>
    </motion.li>
  )
}
