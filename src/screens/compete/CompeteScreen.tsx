import { useState } from 'react'
import { api } from '../../api'
import { useLive } from '../../api/useLive'
import type { LeaderboardScope } from '../../api/types'
import { ErrorNote, ScreenHeader, Section, Segmented, Skeleton } from '../../components/ui/ui'
import { SummitCard } from '../../components/summit/SummitCard'
import { ChallengeRow } from '../../components/ChallengeRow'
import { Leaderboard } from '../../components/Leaderboard'
import s from './compete.module.css'

export function CompeteScreen() {
  const [scope, setScope] = useState<LeaderboardScope>('individual')
  const summit = useLive('summit', () => api.getSummit(), ['summit'])
  const challenges = useLive('challenges', () => api.listChallenges(), ['challenges'])
  const board = useLive(`board:${scope}`, () => api.getLeaderboard(scope), ['leaderboard'])

  return (
    <div>
      <ScreenHeader eyebrow="This week" title="Compete" />

      {summit.data ? (
        <SummitCard summit={summit.data} />
      ) : summit.error ? (
        <ErrorNote error={summit.error} onRetry={summit.reload} />
      ) : (
        <Skeleton h={380} />
      )}

      <Section title="Challenges">
        <div className={s.stack}>
          {challenges.data?.map((c) => (
            <ChallengeRow key={c.id} c={c} onJoin={(id) => void api.joinChallenge(id)} />
          )) ?? <Skeleton h={140} />}
        </div>
      </Section>

      <Section title="Leaderboard · MovePoints this week">
        <Segmented
          value={scope}
          onChange={setScope}
          options={[
            { value: 'individual', label: 'Individual' },
            { value: 'department', label: 'Department' },
          ]}
        />
        <div className={s.board}>
          {board.data ? (
            <Leaderboard entries={board.data} unit="pts" />
          ) : board.error ? (
            <ErrorNote error={board.error} onRetry={board.reload} />
          ) : (
            <Skeleton h={320} />
          )}
        </div>
      </Section>
    </div>
  )
}
