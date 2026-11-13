import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { api } from '../api'
import { SPRING_POP } from '../lib/motion'
import type { Notice } from '../api/types'
import s from './Toaster.module.css'

/** Shows backend-pushed notices (points, badges, verifications). */
export function Toaster() {
  const [items, setItems] = useState<Notice[]>([])

  useEffect(
    () =>
      api.subscribe(['notice'], (e) => {
        if (e.topic !== 'notice') return
        const n = e.notice
        setItems((xs) => [...xs.filter((x) => x.id !== n.id), n].slice(-3))
        window.setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== n.id)), 4200)
      }),
    [],
  )

  return (
    <div className={s.stack} aria-live="polite">
      <AnimatePresence initial={false}>
        {items.map((n) => (
          <motion.div
            key={n.id}
            layout
            className={`${s.toast} ${s[n.tone]}`}
            initial={{ opacity: 0, y: -14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98, transition: { duration: 0.18 } }}
            transition={SPRING_POP}
            onClick={() => setItems((xs) => xs.filter((x) => x.id !== n.id))}
          >
            <span className={s.mark} aria-hidden />
            <div className={s.text}>
              <div className={s.title}>{n.title}</div>
              <div className={s.body}>{n.body}</div>
            </div>
            {n.points !== null && (
              <div className={`num ${s.points}`}>
                {n.points > 0 ? '+' : ''}
                {n.points}
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
