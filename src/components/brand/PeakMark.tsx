/**
 * Peak mark: a summit reached by steps — three treads climb the left flank
 * to the peak ("Every step climbs"). Matches public/peak.svg and the logo
 * reveal's input.
 */
export const PEAK_PATH = 'M5 25V21.5h4V18h4v-3.5h3.2L19.5 7 27 25z'

export function PeakMark({ size = 24, framed = true }: { size?: number; framed?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={{ flex: 'none', display: 'block' }}>
      {framed && <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" fill="#111" stroke="rgba(255,255,255,0.12)" />}
      <path d={PEAK_PATH} fill="#eeeeee" />
    </svg>
  )
}
