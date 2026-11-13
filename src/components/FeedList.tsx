import { AnimatePresence, motion } from 'framer-motion'
import type { FeedItem } from '../api/types'
import { timeAgo } from '../lib/format'
import { Avatar } from './ui/Avatar'
import s from './FeedList.module.css'

export function FeedList({ items }: { items: FeedItem[] }) {
  return (
    <ul className={s.list}>
      <AnimatePresence initial={false}>
        {items.map((f) => (
          <motion.li
            key={f.id}
            layout
            className={s.item}
            initial={{ opacity: 0, y: -10, backgroundColor: 'rgba(200,241,105,0.08)' }}
            animate={{ opacity: 1, y: 0, backgroundColor: 'rgba(200,241,105,0)' }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], backgroundColor: { duration: 2 } }}
          >
            <Avatar name={f.actorName} size={34} />
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
