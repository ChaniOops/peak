import { formatNumber } from '../../lib/format'
import s from './RollingNumber.module.css'

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

/**
 * Odometer-style number: each digit is a column that rolls to its new value
 * (transform only, glide curve, slight right-to-left stagger). Columns are
 * keyed from the right so units stay units when the number grows. Reduced
 * motion is honoured by the global transition override.
 */
export function RollingNumber({
  value,
  format = formatNumber,
  className = '',
}: {
  value: number
  format?: (n: number) => string
  className?: string
}) {
  const text = format(value)
  const chars = text.split('')
  return (
    <span className={`${s.root} ${className}`} aria-label={text} role="img">
      {chars.map((ch, i) => {
        const fromRight = chars.length - 1 - i
        const d = DIGITS.indexOf(ch)
        if (d < 0) {
          return (
            <span key={`s${fromRight}`} className={s.static} aria-hidden="true">
              {ch}
            </span>
          )
        }
        return (
          <span key={`d${fromRight}`} className={s.col} aria-hidden="true">
            <span className={s.strip} style={{ transform: `translateY(${-d * 10}%)`, transitionDelay: `${fromRight * 28}ms` }}>
              {DIGITS.map((n) => (
                <span key={n}>{n}</span>
              ))}
            </span>
          </span>
        )
      })}
    </span>
  )
}
