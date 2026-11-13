import type { SummitProgress } from '../../api/types'
import { formatNumber } from '../../lib/format'
import { Card, ProgressBar } from '../ui/ui'

/** Interim summit card; replaced by the Everest route visual. */
export function SummitCard({ summit }: { summit: SummitProgress; compact?: boolean }) {
  const ratio = summit.steps / summit.targetSteps
  return (
    <Card>
      <div className="num" style={{ fontSize: 28 }}>
        {formatNumber(summit.steps)} / {formatNumber(summit.targetSteps)}
      </div>
      <ProgressBar value={ratio} />
    </Card>
  )
}
