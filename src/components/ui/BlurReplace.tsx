import type { ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

/**
 * FeralUI "iOS swap": when `id` changes, the old content blurs/shrinks out
 * while the new content blurs in, instead of the text jumping. The live copy
 * is mirrored into a visually-hidden node so screen readers read it once.
 */
const SWAP = { type: 'spring', duration: 0.25, bounce: 0 } as const
const OUT = { opacity: 0, filter: 'blur(4px)', scale: 0.9 }
const IN = { opacity: 1, filter: 'blur(0px)', scale: 1 }

const sr: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
}

export function BlurReplace({
  id,
  children,
  block,
  origin = 'center',
  className,
}: {
  id: string | number
  children: ReactNode
  block?: boolean
  origin?: string
  className?: string
}) {
  const reduce = useReducedMotion()
  const copy = {
    'aria-hidden': true as const,
    style: { transformOrigin: origin, display: 'block', gridArea: '1 / 1' },
    initial: OUT,
    animate: IN,
    exit: OUT,
    transition: reduce ? { duration: 0 } : SWAP,
  }
  // a 1×1 grid stacks the outgoing and incoming copies in the same cell
  const wrap: React.CSSProperties = { display: block ? 'grid' : 'inline-grid', position: 'relative' }
  return block ? (
    <div className={className} style={wrap}>
      <AnimatePresence initial={false}>
        <motion.div key={id} {...copy}>
          {children}
        </motion.div>
      </AnimatePresence>
      <div style={sr}>{children}</div>
    </div>
  ) : (
    <span className={className} style={wrap}>
      <AnimatePresence initial={false}>
        <motion.span key={id} {...copy}>
          {children}
        </motion.span>
      </AnimatePresence>
      <span style={sr}>{children}</span>
    </span>
  )
}
