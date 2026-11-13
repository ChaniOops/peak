import { motion } from 'framer-motion'
import { POP_EASE } from '../../lib/motion'

/**
 * Success: a white glass disc pops in (overshoot curve), then a dark check
 * draws its stroke. One shared moment for session saved, check-in verified
 * and reward redeemed. Reduced motion → appears complete (MotionConfig).
 */
export function SuccessCheck({ size = 56, delay = 0 }: { size?: number; delay?: number }) {
  return (
    <motion.span
      aria-hidden="true"
      style={{
        position: 'relative',
        display: 'grid',
        placeItems: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 30% 22%, rgba(255,255,255,.9), rgba(255,255,255,0) 34%), linear-gradient(180deg, #f4f4f4, #cfcfcf)',
        boxShadow: 'inset 0 1px 0 #fff, inset 0 -1px 0 rgba(0,0,0,.18), 0 10px 26px -12px rgba(0,0,0,.9)',
      }}
      initial={{ scale: 0.4, opacity: 0, filter: 'blur(4px)' }}
      animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
      transition={{ delay, duration: 0.5, ease: POP_EASE }}
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none">
        <motion.path
          d="M5 12.5l4.5 4.5L19 7.5"
          stroke="#0d0d0d"
          strokeWidth={2.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: delay + 0.22, duration: 0.42, ease: [0.65, 0, 0.35, 1] }}
        />
      </svg>
    </motion.span>
  )
}
