import { useSession } from '../../tracking/sessionStore'
import { TrackSetup } from './TrackSetup'
import { LiveSession } from './LiveSession'
import { SessionSummary } from './SessionSummary'

export function TrackScreen() {
  const phase = useSession((s) => s.phase)
  if (phase === 'idle') return <TrackSetup />
  if (phase === 'active' || phase === 'paused') return <LiveSession />
  return <SessionSummary />
}
