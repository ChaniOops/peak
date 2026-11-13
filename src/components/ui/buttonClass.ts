import s from './ui.module.css'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'contrast'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl'
export type ButtonStyle = { variant?: ButtonVariant; size?: ButtonSize; block?: boolean }

export const cx = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(' ')

/**
 * Pointer light: the glass catches the cursor (mouse only, CSS vars only —
 * nothing re-renders and touch devices never pay for it).
 */
export const glassLight = {
  onPointerMove(e: { pointerType: string; currentTarget: HTMLElement; clientX: number; clientY: number }) {
    if (e.pointerType !== 'mouse') return
    const r = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--lx', `${e.clientX - r.left}px`)
    e.currentTarget.style.setProperty('--ly', `${e.clientY - r.top}px`)
  },
  onPointerLeave(e: { currentTarget: HTMLElement }) {
    e.currentTarget.style.removeProperty('--lx')
    e.currentTarget.style.removeProperty('--ly')
  },
}

/** Button styling for non-button elements (router Links used as CTAs). */
export const buttonClass = ({ variant = 'primary', size = 'md', block }: ButtonStyle, extra = '') =>
  cx(s.btn, s[variant], s[size], block && s.block, extra)
