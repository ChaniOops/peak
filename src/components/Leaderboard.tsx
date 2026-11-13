import { useEffect, useState } from 'react'
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { ArrowDown, ArrowUp } from 'lucide-react'
import type { LeaderboardEntry } from '../api/types'
import { SPRING_LAYOUT } from '../lib/motion'
import { Avatar } from './ui/Avatar'
import { RollingNumber } from './ui/RollingNumber'
import { EmptyState } from './ui/ui'
import s from './Leaderboard.module.css'

const TOP = 10
const pad2 = (n: number) => String(Math.round(n)).padStart(2, '0')

/**
 * Ranks and points are rendered exactly as the API returns them. When a
 * realtime update moves someone, their row glides to its new place, the rank
 * and points roll, and a small delta (▲1) rides on the row for a few seconds.
 */
export function Leaderboard({ entries, unit }: { entries: LeaderboardEntry[]; unit: string }) {
  // derive rank movement during render from the previous entries (no effect state)
  const [prev, setPrev] = useState(entries)
  const [moves, setMoves] = useState<Map<string, number>>(() => new Map())
  if (entries !== prev) {
    const before = new Map(prev.map((e) => [e.id, e.rank]))
    const next = new Map<string, number>()
    for (const e of entries) {
      const p = before.get(e.id)
      if (p !== undefined && p !== e.rank) next.set(e.id, p - e.rank)
    }
    setPrev(entries)
    if (next.size) setMoves(next)
  }
  useEffect(() => {
    if (!moves.size) return
    const t = window.setTimeout(() => setMoves(new Map()), 4000)
    return () => window.clearTimeout(t)
  }, [moves])

  if (!entries.length) return <EmptyState title="No scores yet" body="The board fills in as people move this week." />
  const top = entries.slice(0, TOP)
  const me = entries.find((e) => e.isMe)
  const meOutside = me && me.rank > TOP

  return (
    <div className={s.table}>
      <div className={s.head} aria-hidden>
        <span className={s.hRank}>#</span>
        <span className={s.hName}>Name</span>
        <span className={s.hPts}>Points</span>
      </div>
      <LayoutGroup>
        <ol className={s.list}>
          {top.map((e) => (
            <Row key={e.id} e={e} unit={unit} moved={moves.get(e.id)} />
          ))}
          {meOutside && (
            <>
              <li className={s.gap} aria-hidden>
                <span />
              </li>
              <Row e={me} unit={unit} moved={moves.get(me.id)} />
            </>
          )}
        </ol>
      </LayoutGroup>
    </div>
  )
}

function Row({ e, unit, moved }: { e: LeaderboardEntry; unit: string; moved?: number }) {
  return (
    <motion.li
      layout="position"
      transition={SPRING_LAYOUT}
      className={`${s.row} ${e.isMe ? s.me : ''} ${moved ? s.moved : ''}`}
    >
      <span className={`${s.rank} ${e.rank <= 3 ? s.podium : ''}`}>
        <RollingNumber value={e.rank} format={pad2} />
      </span>
      <Avatar name={e.name} size={28} highlight={e.isMe} />
      <div className={s.who}>
        <div className={s.name}>
          <span className={s.nameText}>{e.name}</span>
          {e.isMe && <span className={s.youTag}>You</span>}
          <AnimatePresence>
            {moved ? (
              <motion.span
                key={moved}
                className={moved > 0 ? `tag tag-yellow ${s.delta}` : `${s.delta} ${s.down}`}
                initial={{ opacity: 0, y: moved > 0 ? 6 : -6, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.18 } }}
                transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                aria-label={`${moved > 0 ? 'up' : 'down'} ${Math.abs(moved)}`}
              >
                {moved > 0 ? <ArrowUp size={10} strokeWidth={3} /> : <ArrowDown size={10} strokeWidth={3} />}
                {Math.abs(moved)}
              </motion.span>
            ) : null}
          </AnimatePresence>
        </div>
        <div className={s.sub}>{e.subtitle}</div>
      </div>
      <span className={`num ${s.points}`} aria-label={`${e.points} ${unit}`}>
        <RollingNumber value={e.points} />
      </span>
    </motion.li>
  )
}
