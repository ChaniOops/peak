import { AnimatePresence, motion } from 'framer-motion'
import { useSession } from '../../tracking/sessionStore'
import { EASE_OUT } from '../../lib/motion'
import { TrackSetup } from './TrackSetup'
import { LiveSession } from './LiveSession'
import { SessionSummary } from './SessionSummary'

/**
 * choose → live (active ⇄ paused) → summary. Only the stage wrapper animates;
 * active/paused share one stage so the map and sensors never remount.
 */
export function TrackScreen() {
  const phase = useSession((s) => s.phase)
  const stage = phase === 'idle' || phase === 'starting' ? 'setup' : phase === 'active' || phase === 'paused' ? 'live' : 'summary'
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={stage}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6, transition: { duration: 0.16 } }}
        transition={{ duration: 0.4, ease: EASE_OUT }}
      >
        {stage === 'setup' ? <TrackSetup /> : stage === 'live' ? <LiveSession /> : <SessionSummary />}
      </motion.div>
    </AnimatePresence>
  )
}
