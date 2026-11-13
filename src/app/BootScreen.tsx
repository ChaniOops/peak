import { motion } from 'framer-motion'
import { PeakLogoReveal } from '../components/brand/PeakLogoReveal'
import { EASE_OUT } from '../lib/motion'
import s from './BootScreen.module.css'

/**
 * Boot: the signature Liquid Glass reveal of the Peak mark, once per browser
 * session (AuthGate decides), over the midnight the reveal is lit for. The
 * session restores underneath; the overlay fades away when both are done.
 */
export function BootScreen({ play, onDone }: { play: boolean; onDone: () => void }) {
  return (
    <motion.div
      className={s.root}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5, ease: EASE_OUT } }}
      aria-label="Loading Peak"
      role="status"
    >
      <div className={s.stack}>
        {play ? <PeakLogoReveal size={112} onDone={onDone} /> : <div style={{ height: 213 }} />}
        <motion.span
          className={s.word}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: play ? 1.25 : 0.1, duration: 0.6, ease: EASE_OUT }}
        >
          Peak
        </motion.span>
      </div>
    </motion.div>
  )
}
