import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import s from './ui.module.css'

export function ScreenHeader({ eyebrow, title, right }: { eyebrow?: string; title: string; right?: ReactNode }) {
  return (
    <header className={s.header}>
      <div>
        {eyebrow && <div className="label">{eyebrow}</div>}
        <h1 className={`display ${s.title}`}>{title}</h1>
      </div>
      {right}
    </header>
  )
}

export function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: { to: string; label: string }
  children: ReactNode
}) {
  return (
    <section className={s.section}>
      <div className={s.sectionHead}>
        <h2 className="label">{title}</h2>
        {action && (
          <Link to={action.to} className={s.sectionAction}>
            {action.label} <ChevronRight size={14} />
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

export function Card({ children, className = '', pad = true }: { children: ReactNode; className?: string; pad?: boolean }) {
  return <div className={`${s.card} ${pad ? s.pad : ''} ${className}`}>{children}</div>
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
export function Button({
  variant = 'primary',
  size = 'md',
  block,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; block?: boolean }) {
  return (
    <button
      className={`${s.btn} ${s[variant]} ${s[size]} ${block ? s.block : ''} ${className}`}
      {...rest}
    />
  )
}

export type Tone = 'neutral' | 'accent' | 'ice' | 'ember' | 'danger'
export function Chip({ tone = 'neutral', children, dot }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={`${s.chip} ${s[`tone_${tone}`]}`}>
      {dot && <span className={s.dot} />}
      {children}
    </span>
  )
}

export function Stat({ label, value, unit, big }: { label: string; value: ReactNode; unit?: string; big?: boolean }) {
  return (
    <div className={s.stat}>
      <div className={`num ${big ? s.statBig : s.statValue}`}>
        {value}
        {unit && <span className={s.unit}>{unit}</span>}
      </div>
      <div className="label">{label}</div>
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (v: T) => void
}) {
  return (
    <div className={s.segmented} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          className={`${s.segment} ${o.value === value ? s.segmentOn : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function ProgressBar({ value, tone = 'accent' }: { value: number; tone?: 'accent' | 'ice' | 'ember' }) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div className={s.bar}>
      <div className={`${s.barFill} ${s[`fill_${tone}`]}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Skeleton({ h = 72 }: { h?: number }) {
  return <div className={s.skeleton} style={{ height: h }} />
}

export function ErrorNote({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <Card className={s.errorNote}>
      <span>{error.message}</span>
      {onRetry && (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      )}
    </Card>
  )
}

export function Empty({ title, body }: { title: string; body?: string }) {
  return (
    <div className={s.empty}>
      <div className={s.emptyTitle}>{title}</div>
      {body && <div className="muted">{body}</div>}
    </div>
  )
}
