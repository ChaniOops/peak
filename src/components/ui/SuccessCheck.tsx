import { motion } from 'framer-motion'
import { POP_EASE } from '../../lib/motion'

/**
 * Success: a glass disc pops in (overshoot curve), then the check draws its
 * stroke. One shared moment for session saved, check-in verified and reward
 * redeemed. Reduced motion → appears complete (MotionConfig).
 */
export function SuccessCheck({ size = 56, tone = 'lime', delay = 0 }: { size?: number; tone?: 'lime' | 'ice'; delay?: number }) {
  const c = tone === 'lime' ? ['#e2f9b0', '#b7e35a', '#173006'] : ['#d6f1fb', '#8cd2f0', '#06263a']
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
        background: `radial-gradient(circle at 30% 22%, rgba(255,255,255,.75), rgba(255,255,255,0) 32%), linear-gradient(180deg, ${c[0]}, ${c[1]})`,
        boxShadow: `inset 0 1px 0 #fff, inset 1px 0 0 rgba(255,176,136,.3), inset -1px 0 0 rgba(110,220,255,.35), 0 10px 26px -10px ${tone === 'lime' ? 'rgba(200,241,105,.55)' : 'rgba(140,210,240,.55)'}`,
      }}
      initial={{ scale: 0.4, opacity: 0, filter: 'blur(4px)' }}
      animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
      transition={{ delay, duration: 0.5, ease: POP_EASE }}
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none">
        <motion.path
          d="M5 12.5l4.5 4.5L19 7.5"
          stroke={c[2]}
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
