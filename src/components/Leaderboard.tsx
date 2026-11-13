import { LayoutGroup, motion } from 'framer-motion'
import type { LeaderboardEntry } from '../api/types'
import { SPRING_LAYOUT } from '../lib/motion'
import { Avatar } from './ui/Avatar'
import { AnimatedNumber } from './ui/AnimatedNumber'
import { EmptyState } from './ui/ui'
import s from './Leaderboard.module.css'

const TOP = 10

/** Ranks and points are rendered exactly as the API returns them. */
export function Leaderboard({ entries, unit }: { entries: LeaderboardEntry[]; unit: string }) {
  if (!entries.length) return <EmptyState title="No scores yet" body="The board fills in as people move this week." />
  const top = entries.slice(0, TOP)
  const me = entries.find((e) => e.isMe)
  const meOutside = me && me.rank > TOP

  return (
    <div className={s.table}>
      <div className={s.head} aria-hidden>
        <span className={s.hRank}>#</span>
        <span className={s.hName}>Name</span>
        <span className={s.hPts}>{unit}</span>
      </div>
      <LayoutGroup>
        <ol className={s.list}>
          {top.map((e) => (
            <Row key={e.id} e={e} unit={unit} />
          ))}
          {meOutside && (
            <>
              <li className={s.gap} aria-hidden>
                <span />
              </li>
              <Row e={me} unit={unit} />
            </>
          )}
        </ol>
      </LayoutGroup>
    </div>
  )
}

function Row({ e, unit }: { e: LeaderboardEntry; unit: string }) {
  return (
    <motion.li layout="position" transition={SPRING_LAYOUT} className={`${s.row} ${e.isMe ? s.me : ''}`}>
      <span className={`${s.rank} ${e.rank <= 3 ? s.podium : ''}`}>{String(e.rank).padStart(2, '0')}</span>
      <Avatar name={e.name} size={28} highlight={e.isMe} />
      <div className={s.who}>
        <div className={s.name}>
          <span className={s.nameText}>{e.name}</span>
          {e.isMe && <span className={s.youTag}>You</span>}
        </div>
        <div className={s.sub}>{e.subtitle}</div>
      </div>
      <span className={`num ${s.points}`} aria-label={`${e.points} ${unit}`}>
        <AnimatedNumber value={e.points} duration={0.6} />
      </span>
    </motion.li>
  )
}
