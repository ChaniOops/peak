/** Peak glyph (matches public/peak.svg): a white massif with a grey summit notch. */
export function PeakMark({ size = 24, framed = true }: { size?: number; framed?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={{ flex: 'none', display: 'block' }}>
      {framed && <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" fill="#111" stroke="rgba(255,255,255,0.12)" />}
      <path d="M5 24.5 13 10l4.6 7.4 2.8-3.7 6.6 10.8z" fill="#f5f5f5" />
      <path d="M13 10l-2.4 4.3 2.4-1.3 2 1.5z" fill="#8c8c8c" />
    </svg>
  )
}
