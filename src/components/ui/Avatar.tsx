function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

/** Neutral monogram; `highlight` marks the current user with a restrained lime ring. */
export function Avatar({ name, size = 36, highlight }: { name: string; size?: number; highlight?: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        flex: 'none',
        display: 'grid',
        placeItems: 'center',
        borderRadius: '50%',
        background: highlight ? 'rgba(200, 241, 105, 0.1)' : 'linear-gradient(180deg, #1c1c1c, #121212)',
        color: highlight ? 'var(--accent)' : 'var(--text-2)',
        boxShadow: highlight ? 'inset 0 0 0 1px rgba(200, 241, 105, 0.35)' : 'inset 0 0 0 1px var(--line-strong)',
        fontFamily: 'var(--font-body)',
        fontSize: size * 0.36,
        fontWeight: 600,
        letterSpacing: '-0.02em',
      }}
    >
      {initials(name)}
    </span>
  )
}
