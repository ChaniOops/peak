import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ScanLine, ArrowRight, CalendarDays } from 'lucide-react'
import { api, ApiError } from '../../api'
import { useLive } from '../../api/useLive'
import { ErrorNote, ScreenHeader, Section, Skeleton, Chip, EmptyState, List, ListRow, Notice } from '../../components/ui/ui'
import { buttonClass } from '../../components/ui/buttonClass'
import { EventCard } from '../../components/EventCard'
import { timeAgo } from '../../lib/format'
import s from './play.module.css'

export function PlayScreen() {
  const events = useLive('events', () => api.listEvents(), ['events'])
  const mine = useLive('my-checkins', () => api.listMyCheckIns(), ['checkins'])
  const [busy, setBusy] = useState<string | null>(null)
  const [joinError, setJoinError] = useState<string | null>(null)

  async function join(id: string) {
    setBusy(id)
    setJoinError(null)
    try {
      await api.joinEvent(id)
    } catch (e) {
      setJoinError(e instanceof ApiError ? e.message : 'Could not join event')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <ScreenHeader eyebrow="Verified on campus" title="Play" />

      <Link to="/play/scan" className={buttonClass({ variant: 'primary', size: 'xl', block: true }, s.scanCta)}>
        <span className={s.scanIcon}>
          <ScanLine size={20} />
        </span>
        <span className={s.scanText}>
          <strong>Scan event QR</strong>
          <span>Check in at the venue · verified points</span>
        </span>
        <ArrowRight size={18} className={s.scanArrow} />
      </Link>

      {mine.data && mine.data.length > 0 && (
        <Section title="Your check-ins">
          <List>
            {mine.data.slice(0, 4).map((c) => (
              <ListRow
                key={c.id}
                title={c.eventTitle}
                meta={`Scanned ${timeAgo(c.scannedAt)}`}
                trailing={
                  c.status === 'pending' ? (
                    <Chip tone="ember" dot>
                      Pending verification
                    </Chip>
                  ) : c.status === 'verified' ? (
                    <Chip tone="ice" dot>
                      Verified
                    </Chip>
                  ) : (
                    <Chip tone="danger" dot>
                      Not approved
                    </Chip>
                  )
                }
              />
            ))}
          </List>
        </Section>
      )}

      <Section title="This week on campus">
        {joinError && (
          <div className={s.error}>
            <Notice tone="danger">{joinError}</Notice>
          </div>
        )}
        {events.data ? (
          events.data.length ? (
            <div className={s.events}>
              {events.data.map((e) => (
                <EventCard key={e.id} e={e} busy={busy === e.id} onJoin={() => void join(e.id)} />
              ))}
            </div>
          ) : (
            <EmptyState icon={<CalendarDays size={18} />} title="No events yet" body="Organisers haven’t posted anything this week." />
          )
        ) : events.error ? (
          <ErrorNote error={events.error} onRetry={events.reload} />
        ) : (
          <Skeleton h={300} />
        )}
      </Section>
    </div>
  )
}
