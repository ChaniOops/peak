import s from './ui.module.css'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'contrast'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl'
export type ButtonStyle = { variant?: ButtonVariant; size?: ButtonSize; block?: boolean }

export const cx = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(' ')

/** Button styling for non-button elements (router Links used as CTAs). */
export const buttonClass = ({ variant = 'primary', size = 'md', block }: ButtonStyle, extra = '') =>
  cx(s.btn, s[variant], s[size], block && s.block, extra)
