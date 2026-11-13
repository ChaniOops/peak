import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import QRCode from 'qrcode'
import { Check, X } from 'lucide-react'
import { api, ApiError } from '../../api'
import { useLive } from '../../api/useLive'
import type { CheckIn } from '../../api/types'
import { Button, Chip, Empty, ErrorNote, Skeleton } from '../../components/ui/ui'
import { Avatar } from '../../components/ui/Avatar'
import { formatEventTime, timeAgo } from '../../lib/format'
import s from './organiser.module.css'

/**
 * Minimal organiser demo view (hidden deep link, not in navigation):
 * show the event QR and confirm/reject pending check-ins.
 */
export function OrganiserEventScreen() {
  const { eventId = '' } = useParams()
  const event = useLive(`event:${eventId}`, () => api.getEvent(eventId), ['events'])
  const checkIns = useLive(`event-checkins:${eventId}`, () => api.listEventCheckIns(eventId), ['checkins'])
  const payload = useLive(`event-qr:${eventId}`, () => api.getEventQrPayload(eventId), [])

  const pending = checkIns.data?.filter((c) => c.status === 'pending') ?? []
  const decided = checkIns.data?.filter((c) => c.status !== 'pending') ?? []

  return (
    <div className={s.page}>
      <div className={s.head}>
        <Chip tone="ember">Organiser</Chip>
        {event.data && (
          <>
            <h1 className={`display ${s.title}`}>{event.data.title}</h1>
            <p className="muted">
              {formatEventTime(event.data.startsAt, event.data.endsAt).day} ·{' '}
              {formatEventTime(event.data.startsAt, event.data.endsAt).time} · {event.data.venue}
            </p>
          </>
        )}
        {event.error && <ErrorNote error={event.error} />}
      </div>

      <div className={s.grid}>
        <section className={s.qrCard}>
          <div className="label">Students scan to check in</div>
          {payload.data ? <QrImage text={payload.data} /> : <Skeleton h={240} />}
          {payload.data && <code className={s.code}>{codeFrom(payload.data)}</code>}
        </section>

        <section>
          <div className={s.listHead}>
            <h2 className="label">Pending</h2>
            <span className={`num ${s.count}`}>{pending.length}</span>
          </div>
          {checkIns.data ? (
            pending.length ? (
              <ul className={s.list}>
                <AnimatePresence initial={false}>
                  {pending.map((c) => (
                    <PendingRow key={c.id} c={c} />
                  ))}
                </AnimatePresence>
              </ul>
            ) : (
              <Empty title="No one waiting" body="New check-ins appear here live." />
            )
          ) : (
            <Skeleton h={160} />
          )}

          {decided.length > 0 && (
            <>
              <div className={s.listHead} style={{ marginTop: 22 }}>
                <h2 className="label">Decided</h2>
              </div>
              <ul className={s.list}>
                {decided.map((c) => (
                  <li key={c.id} className={s.row}>
                    <Avatar name={c.userName} size={32} />
                    <div className={s.who}>
                      <div className={s.name}>{c.userName}</div>
                      <div className={s.sub}>{c.departmentName}</div>
                    </div>
                    <Chip tone={c.status === 'verified' ? 'ice' : 'danger'} dot>
                      {c.status}
                    </Chip>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

function PendingRow({ c }: { c: CheckIn }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function decide(d: 'verified' | 'rejected') {
    setBusy(true)
    setError(null)
    try {
      await api.decideCheckIn(c.id, d)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed, try again')
      setBusy(false)
    }
  }

  return (
    <motion.li
      layout
      className={s.row}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24, transition: { duration: 0.2 } }}
    >
      <Avatar name={c.userName} size={32} />
      <div className={s.who}>
        <div className={s.name}>{c.userName}</div>
        <div className={s.sub}>
          {error ?? `${c.departmentName} · scanned ${timeAgo(c.scannedAt)}`}
        </div>
      </div>
      <Button size="sm" variant="danger" disabled={busy} onClick={() => void decide('rejected')} aria-label="Reject">
        <X size={16} />
      </Button>
      <Button size="sm" disabled={busy} onClick={() => void decide('verified')}>
        <Check size={16} /> Confirm
      </Button>
    </motion.li>
  )
}

function QrImage({ text }: { text: string }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    QRCode.toDataURL(text, { margin: 1, width: 560, color: { dark: '#0a0c0b', light: '#e9eee9' } }).then(
      (url) => alive && setSrc(url),
    )
    return () => {
      alive = false
    }
  }, [text])
  return src ? <img src={src} alt="Event check-in QR code" className={s.qr} /> : <Skeleton h={240} />
}

function codeFrom(payload: string) {
  try {
    return new URL(payload).searchParams.get('code') ?? payload
  } catch {
    return payload
  }
}
