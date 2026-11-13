import type { Transition, Variants } from 'framer-motion'

/**
 * Peak motion system. Curves are the FeralUI ClimbScreen values:
 * headings enter on EASE_OUT, the route/pins on SOFT, pins pop on POP_EASE.
 * Reduced motion is handled globally by <MotionConfig reducedMotion="user">.
 */
export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1]
export const SOFT: [number, number, number, number] = [0.22, 1, 0.3, 1]
export const POP_EASE: [number, number, number, number] = [0.34, 1.4, 0.5, 1]

/** small UI (toasts, pills, badges): settles fast, a hint of overshoot */
export const SPRING_POP: Transition = { type: 'spring', stiffness: 420, damping: 30, mass: 0.8 }
/** sliding indicators (tabs, segmented controls) */
export const SPRING_SLIDE: Transition = { type: 'spring', stiffness: 520, damping: 42 }
/** list re-ordering (leaderboard ranks) */
export const SPRING_LAYOUT: Transition = { type: 'spring', stiffness: 380, damping: 36 }

/** screen entrance: short rise + fade */
export const enter = (delay = 0, y = 8): { initial: object; animate: object; transition: Transition } => ({
  initial: { opacity: 0, y },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: EASE_OUT, delay },
})

/** parent/child stagger for screen sections */
export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.02 } },
}
export const rise: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT } },
}
