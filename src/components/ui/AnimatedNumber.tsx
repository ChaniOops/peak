import { useEffect, useRef } from 'react'
import { animate, useReducedMotion } from 'framer-motion'
import { formatNumber } from '../../lib/format'

/** Counts from the previous value to the new one. Display only. */
export function AnimatedNumber({
  value,
  format = formatNumber,
  duration = 0.9,
  from,
}: {
  value: number
  format?: (n: number) => string
  duration?: number
  from?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const prev = useRef(from ?? value)
  const reduce = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduce) {
      el.textContent = format(value)
      prev.current = value
      return
    }
    const controls = animate(prev.current, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        el.textContent = format(v)
      },
    })
    prev.current = value
    return () => controls.stop()
  }, [value, format, duration, reduce])

  return <span ref={ref}>{format(from ?? value)}</span>
}
