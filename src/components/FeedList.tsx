import { AnimatePresence, motion } from 'framer-motion'
import type { FeedItem } from '../api/types'
import { timeAgo } from '../lib/format'
import { EASE_OUT } from '../lib/motion'
import { Avatar } from './ui/Avatar'
import { EmptyState } from './ui/ui'
import s from './FeedList.module.css'

export function FeedList({ items }: { items: FeedItem[] }) {
  if (!items.length) return <EmptyState title="Quiet for now" body="Activity from campus shows up here as it happens." />
  return (
    <ul className={s.list}>
      <AnimatePresence initial={false}>
        {items.map((f) => (
          <motion.li
            key={f.id}
            layout="position"
            className={s.item}
            // new realtime rows slide in and wash out a faint highlight
            initial={{ opacity: 0, y: -8, backgroundColor: 'rgba(255,255,255,0.05)' }}
            animate={{ opacity: 1, y: 0, backgroundColor: 'rgba(255,255,255,0)' }}
            transition={{ duration: 0.45, ease: EASE_OUT, backgroundColor: { duration: 1.8 } }}
          >
            <Avatar name={f.actorName} size={32} />
            <div className={s.body}>
              <div className={s.line}>
                <strong>{f.actorName}</strong> {f.text}
              </div>
              <div className={s.meta}>
                {f.departmentName} · {timeAgo(f.createdAt)}
              </div>
            </div>
            {f.points !== null && <span className={`num ${s.points}`}>+{f.points}</span>}
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  )
}
