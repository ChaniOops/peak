import { api } from '../../api'
import { useLive } from '../../api/useLive'
import { ScreenHeader, Skeleton } from '../../components/ui/ui'
import { SummitCard } from '../../components/summit/SummitCard'

export function CompeteScreen() {
  const summit = useLive('summit', () => api.getSummit(), ['summit'])
  return (
    <div>
      <ScreenHeader eyebrow="This week" title="Compete" />
      {summit.data ? <SummitCard summit={summit.data} /> : <Skeleton h={380} />}
    </div>
  )
}
