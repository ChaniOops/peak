import { motion } from 'framer-motion'
import { PeakMark } from '../components/brand/PeakMark'

/** Shown for the instant the session is being restored. */
export function BootScreen() {
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.55, 1] }}
        transition={{ duration: 1.6, delay: 0.15, repeat: Infinity, repeatType: 'reverse' }}
      >
        <PeakMark size={36} />
      </motion.div>
    </div>
  )
}
