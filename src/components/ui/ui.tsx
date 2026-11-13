import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertCircle, ChevronRight, Loader2, RotateCcw } from 'lucide-react'
import { SPRING_SLIDE } from '../../lib/motion'
import { buttonClass, cx, type ButtonStyle, type ButtonVariant } from './buttonClass'
import s from './ui.module.css'


/* ── Layout ─────────────────────────────────────────────────────────── */

export function ScreenHeader({ eyebrow, title, right }: { eyebrow?: string; title: ReactNode; right?: ReactNode }) {
  return (
    <header className={s.header}>
      <div className={s.headerText}>
        {eyebrow && <div className="label">{eyebrow}</div>}
        <h1 className={`display ${s.title}`}>{title}</h1>
      </div>
      {right}
    </header>
  )
}

export function SectionHeader({ title, action, meta }: { title: string; action?: { to: string; label: string }; meta?: ReactNode }) {
  return (
    <div className={s.sectionHead}>
      <h2 className={s.sectionTitle}>{title}</h2>
      {meta}
      {action && (
        <Link to={action.to} className={s.sectionAction}>
          {action.label} <ChevronRight size={14} />
        </Link>
      )}
    </div>
  )
}

export function Section({
  title,
  action,
  meta,
  children,
}: {
  title: string
  action?: { to: string; label: string }
  meta?: ReactNode
  children: ReactNode
}) {
  return (
    <section className={s.section}>
      <SectionHeader title={title} action={action} meta={meta} />
      {children}
    </section>
  )
}

/** The one surface language: flat near-black, hairline border, top sheen. */
export function Card({
  children,
  className = '',
  pad = true,
  interactive,
}: {
  children: ReactNode
  className?: string
  pad?: boolean
  interactive?: boolean
}) {
  return <div className={cx(s.card, pad && s.pad, interactive && s.interactive, className)}>{children}</div>
}

/* ── Buttons ────────────────────────────────────────────────────────── */

export type { ButtonVariant, ButtonSize } from './buttonClass'

/**
 * Tactile button: CSS `scale` compresses on press and releases on the FeralUI
 * spring curve, so it costs nothing on the main thread.
 */
export function Button({
  variant,
  size,
  block,
  loading,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & ButtonStyle & { loading?: boolean }) {
  return (
    <button className={buttonClass({ variant, size, block }, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <Loader2 size={16} className={s.spin} aria-hidden />}
      {children}
    </button>
  )
}

export function ButtonLink({ variant, size, block, className = '', ...rest }: LinkProps & ButtonStyle) {
  return <Link className={buttonClass({ variant, size, block }, className)} {...rest} />
}

export function IconButton({
  label,
  variant = 'secondary',
  size = 40,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; variant?: ButtonVariant; size?: number }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cx(s.iconBtn, s[variant], className)}
      style={{ width: size, height: size }}
      {...rest}
    >
      {children}
    </button>
  )
}

/* ── Pills ──────────────────────────────────────────────────────────── */

export type Tone = 'neutral' | 'accent' | 'ice' | 'ember' | 'danger'
export function Chip({
  tone = 'neutral',
  children,
  dot,
  glass,
  className = '',
}: {
  tone?: Tone
  children: ReactNode
  dot?: boolean
  glass?: boolean
  className?: string
}) {
  return (
    <span className={cx(s.chip, s[`tone_${tone}`], glass && s.glass, className)}>
      {dot && <span className={s.dot} />}
      {children}
    </span>
  )
}
export const Pill = Chip

/* ── Data ───────────────────────────────────────────────────────────── */

export function Metric({
  label,
  value,
  unit,
  size = 'md',
  align = 'start',
}: {
  label: string
  value: ReactNode
  unit?: string
  size?: 'sm' | 'md' | 'lg'
  align?: 'start' | 'center'
}) {
  return (
    <div className={cx(s.metric, align === 'center' && s.center)}>
      <div className={cx('num', s[`metric_${size}`])}>
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
  label,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (v: T) => void
  label?: string
}) {
  const id = useId()
  return (
    <div className={s.segmented} role="tablist" aria-label={label}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <button key={o.value} role="tab" aria-selected={on} className={cx(s.segment, on && s.segmentOn)} onClick={() => onChange(o.value)}>
            {on && <motion.span layoutId={`seg-${id}`} className={s.segmentThumb} transition={SPRING_SLIDE} />}
            <span className={s.segmentLabel}>{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function ProgressBar({ value, tone = 'accent' }: { value: number; tone?: 'accent' | 'ice' | 'ember' | 'neutral' }) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div className={s.bar} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx(s.barFill, s[`fill_${tone}`])} style={{ width: `${pct}%` }} />
    </div>
  )
}

/* ── Lists ──────────────────────────────────────────────────────────── */

export function List({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <ul className={cx(s.list, className)}>{children}</ul>
}

export function ListRow({
  leading,
  title,
  meta,
  trailing,
  className = '',
}: {
  leading?: ReactNode
  title: ReactNode
  meta?: ReactNode
  trailing?: ReactNode
  className?: string
}) {
  return (
    <li className={cx(s.row, className)}>
      {leading}
      <div className={s.rowMain}>
        <div className={s.rowTitle}>{title}</div>
        {meta && <div className={s.rowMeta}>{meta}</div>}
      </div>
      {trailing}
    </li>
  )
}

/* ── Forms ──────────────────────────────────────────────────────────── */

export function Field({
  label,
  hint,
  error,
  className = '',
  trailing,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: boolean; trailing?: ReactNode }) {
  const id = useId()
  return (
    <label className={cx(s.field, error && s.fieldError, className)} htmlFor={id}>
      <span className={s.fieldLabel}>{label}</span>
      <span className={s.inputWrap}>
        <input id={id} className={s.input} aria-invalid={error || undefined} {...input} />
        {trailing}
      </span>
      {hint && <span className={s.fieldHint}>{hint}</span>}
    </label>
  )
}

/* ── States ─────────────────────────────────────────────────────────── */

export function Skeleton({ h = 72, r }: { h?: number; r?: number }) {
  return <div className={s.skeleton} style={{ height: h, borderRadius: r }} aria-hidden />
}

export function Spinner({ size = 20 }: { size?: number }) {
  return <Loader2 size={size} className={s.spin} aria-label="Loading" />
}

/** Inline, intentional message: permission needed, warnings, failures. */
export function Notice({
  tone = 'neutral',
  icon,
  children,
  action,
}: {
  tone?: Tone
  icon?: ReactNode
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className={cx(s.notice, s[`notice_${tone}`])} role={tone === 'danger' ? 'alert' : undefined}>
      <span className={s.noticeIcon}>{icon ?? <AlertCircle size={16} />}</span>
      <div className={s.noticeText}>{children}</div>
      {action}
    </div>
  )
}

export function ErrorNote({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <Notice
      tone="danger"
      action={
        onRetry && (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            <RotateCcw size={13} /> Retry
          </Button>
        )
      }
    >
      <strong>Couldn’t load this.</strong> <span className="muted">{error.message}</span>
    </Notice>
  )
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className={s.empty}>
      {icon && <span className={s.emptyIcon}>{icon}</span>}
      <div className={s.emptyTitle}>{title}</div>
      {body && <div className={s.emptyBody}>{body}</div>}
      {action && <div className={s.emptyAction}>{action}</div>}
    </div>
  )
}
export const Empty = EmptyState
