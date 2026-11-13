import { Link, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { elapsedMs, isLive, useSession } from '../tracking/sessionStore'
import { useNow } from '../lib/useNow'
import { ACTIVITY_LABEL, formatDuration, formatNumber } from '../lib/format'
import { RollingNumber } from '../components/ui/RollingNumber'
import { BlurReplace } from '../components/ui/BlurReplace'
import s from './LivePill.module.css'

/**
 * Peak's live island: while a session records, a glass capsule floats above
 * the nav on every other tab. It grows out of a blurred bead (toast curve),
 * rolls the elapsed time, and links back to Track.
 */
export function LivePill() {
  const st = useSession()
  const { pathname } = useLocation()
  const show = isLive(st.phase) && pathname !== '/track'
  const paused = st.phase === 'paused'
  const now = useNow(1000, show && !paused)

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className={s.wrap}
          initial={{ opacity: 0, y: 14, scale: 0.55, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: 10, scale: 0.7, filter: 'blur(4px)', transition: { duration: 0.2 } }}
          transition={{ duration: 0.55, ease: [0.18, 1.25, 0.4, 1] }}
        >
          <Link to="/track" className={`${s.pill} pg-float`} aria-label="Return to live session">
            <span className={`${s.dot} ${paused ? s.paused : ''}`} />
            <span className="eyebrow" style={{ color: 'var(--pg-ink-2)' }}>
              <BlurReplace id={paused ? 'p' : 'l'}>
                {ACTIVITY_LABEL[st.type]} {paused ? 'paused' : 'live'}
              </BlurReplace>
            </span>
            <span className={`num ${s.time}`}>
              <RollingNumber value={elapsedMs(st, now) / 1000} format={formatDuration} />
            </span>
            {st.type === 'walk' && st.steps > 0 && (
              <span className={s.steps}>
                <RollingNumber value={st.steps} format={formatNumber} /> steps
              </span>
            )}
            <span className={s.go}>
              <ArrowUpRight size={15} />
            </span>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
