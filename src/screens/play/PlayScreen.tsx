import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ScanLine, ArrowUpRight } from 'lucide-react'
import { api, ApiError } from '../../api'
import { useLive } from '../../api/useLive'
import { ErrorNote, ScreenHeader, Section, Skeleton, Chip, Empty } from '../../components/ui/ui'
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

      <motion.div whileTap={{ scale: 0.98 }}>
        <Link to="/play/scan" className={s.scanCta}>
          <span className={s.scanIcon}>
            <ScanLine size={26} />
          </span>
          <span className={s.scanText}>
            <strong>Scan event QR</strong>
            <span>Check in at the venue to get verified points</span>
          </span>
          <ArrowUpRight size={20} />
        </Link>
      </motion.div>

      {mine.data && mine.data.length > 0 && (
        <Section title="Your check-ins">
          <ul className={s.checkins}>
            {mine.data.slice(0, 4).map((c) => (
              <li key={c.id} className={s.checkin}>
                <div>
                  <div className={s.ciTitle}>{c.eventTitle}</div>
                  <div className={s.ciMeta}>Scanned {timeAgo(c.scannedAt)}</div>
                </div>
                {c.status === 'pending' && (
                  <Chip tone="ember" dot>
                    Pending
                  </Chip>
                )}
                {c.status === 'verified' && (
                  <Chip tone="ice" dot>
                    Verified
                  </Chip>
                )}
                {c.status === 'rejected' && (
                  <Chip tone="danger" dot>
                    Rejected
                  </Chip>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="This week on campus">
        {joinError && <p className={s.error}>{joinError}</p>}
        {events.data ? (
          events.data.length ? (
            <div className={s.events}>
              {events.data.map((e) => (
                <EventCard key={e.id} e={e} busy={busy === e.id} onJoin={() => void join(e.id)} />
              ))}
            </div>
          ) : (
            <Empty title="No events yet" body="Organisers haven’t posted anything this week." />
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
