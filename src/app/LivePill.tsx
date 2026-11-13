import { Link, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { SPRING_POP } from '../lib/motion'
import { elapsedMs, isLive, useSession } from '../tracking/sessionStore'
import { useNow } from '../lib/useNow'
import { ACTIVITY_LABEL, formatDuration } from '../lib/format'
import s from './LivePill.module.css'

/** Visible on other tabs while a session is recording. */
export function LivePill() {
  const st = useSession()
  const { pathname } = useLocation()
  const show = isLive(st.phase) && pathname !== '/track'
  const now = useNow(1000, show && st.phase === 'active')

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className={s.wrap}
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, transition: { duration: 0.18 } }}
          transition={SPRING_POP}
        >
          <Link to="/track" className={s.pill}>
            <span className={`${s.dot} ${st.phase === 'paused' ? s.paused : ''}`} />
            <span className="label" style={{ color: 'var(--text-2)' }}>
              {ACTIVITY_LABEL[st.type]} {st.phase === 'paused' ? 'paused' : 'live'}
            </span>
            <span className={`num ${s.time}`}>{formatDuration(elapsedMs(st, now) / 1000)}</span>
            <span className={s.go}>
              <ArrowUpRight size={15} />
            </span>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
