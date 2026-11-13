function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

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
        background: highlight ? 'var(--accent)' : 'var(--surface-3)',
        color: highlight ? 'var(--accent-ink)' : 'var(--text-2)',
        border: highlight ? 0 : '1px solid var(--line-strong)',
        fontFamily: 'var(--font-mono)',
        fontSize: size * 0.34,
        fontWeight: 600,
      }}
    >
      {initials(name)}
    </span>
  )
}
