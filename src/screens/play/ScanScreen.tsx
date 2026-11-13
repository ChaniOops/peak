import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronLeft, Hourglass, X } from 'lucide-react'
import { api, ApiError } from '../../api'
import { useLive } from '../../api/useLive'
import { QrScanner } from '../../components/qr/QrScanner'
import { Button } from '../../components/ui/ui'
import s from './play.module.css'

type Phase =
  | { kind: 'scan' }
  | { kind: 'submitting' }
  | { kind: 'submitted'; checkInId: string; eventId: string }
  | { kind: 'error'; message: string }

export function ScanScreen() {
  const [params] = useSearchParams()
  const deepLinkCode = params.get('code')
  // A phone camera opening the organiser's QR lands here with ?code=…
  const [phase, setPhase] = useState<Phase>(() => (deepLinkCode ? { kind: 'submitting' } : { kind: 'scan' }))
  const [manual, setManual] = useState('')
  const [showManual, setShowManual] = useState(false)
  const inFlight = useRef(false)

  async function submit(raw: string) {
    if (inFlight.current) return
    inFlight.current = true
    setPhase({ kind: 'submitting' })
    try {
      const ci = await api.checkIn(raw)
      setPhase({ kind: 'submitted', checkInId: ci.id, eventId: ci.eventId })
    } catch (e) {
      setPhase({ kind: 'error', message: e instanceof ApiError ? e.message : 'Check-in failed. Try again.' })
    } finally {
      inFlight.current = false
    }
  }

  useEffect(() => {
    if (!deepLinkCode) return
    let done = false
    api
      .checkIn(deepLinkCode)
      .then((ci) => !done && setPhase({ kind: 'submitted', checkInId: ci.id, eventId: ci.eventId }))
      .catch((e: unknown) => !done && setPhase({ kind: 'error', message: e instanceof ApiError ? e.message : 'Check-in failed.' }))
    return () => {
      done = true
    }
  }, [deepLinkCode])

  return (
    <div className={s.scanPage}>
      <Link to="/play" className={s.back}>
        <ChevronLeft size={18} /> Play
      </Link>
      <h1 className="display" style={{ fontSize: 40 }}>
        Check in
      </h1>

      {phase.kind === 'scan' && (
        <>
          <QrScanner onResult={(t) => void submit(t)} />
          {showManual ? (
            <form
              className={s.manual}
              onSubmit={(e) => {
                e.preventDefault()
                if (manual.trim()) void submit(manual.trim())
              }}
            >
              <input
                className={s.input}
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="Event code"
                autoCapitalize="off"
                autoCorrect="off"
                autoFocus
              />
              <Button type="submit" disabled={!manual.trim()}>
                Check in
              </Button>
            </form>
          ) : (
            <button className={s.linkish} onClick={() => setShowManual(true)}>
              Enter code instead
            </button>
          )}
        </>
      )}

      {phase.kind === 'submitting' && (
        <div className={s.result}>
          <div className={`${s.resultIcon} ${s.pendingIcon}`}>
            <Hourglass size={30} />
          </div>
          <div className="label">Checking in…</div>
        </div>
      )}

      {phase.kind === 'error' && (
        <div className={s.result}>
          <div className={`${s.resultIcon} ${s.rejectedIcon}`}>
            <X size={32} />
          </div>
          <p>{phase.message}</p>
          <Button variant="secondary" onClick={() => setPhase({ kind: 'scan' })}>
            Scan again
          </Button>
        </div>
      )}

      {phase.kind === 'submitted' && <CheckInStatus checkInId={phase.checkInId} eventId={phase.eventId} />}
    </div>
  )
}

/** Follows one check-in through pending → verified/rejected via realtime. */
function CheckInStatus({ checkInId, eventId }: { checkInId: string; eventId: string }) {
  const mine = useLive('my-checkins', () => api.listMyCheckIns(), ['checkins'])
  const event = useLive(`event:${eventId}`, () => api.getEvent(eventId), ['events'])
  const ci = mine.data?.find((c) => c.id === checkInId)
  const status = ci?.status ?? 'pending'
  const title = ci?.eventTitle ?? event.data?.title ?? ''

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        className={s.result}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        {status === 'pending' && (
          <>
            <div className={`${s.resultIcon} ${s.pendingIcon}`}>
              <Hourglass size={30} />
            </div>
            <div className={`display ${s.resultTitle}`}>Checked in</div>
            <div className={s.resultEvent}>{title}</div>
            <p className="muted">Waiting for the organiser to verify you</p>
            <span className={s.dots}>
              <span />
              <span />
              <span />
            </span>
          </>
        )}
        {status === 'verified' && (
          <>
            <motion.div
              className={`${s.resultIcon} ${s.verifiedIcon}`}
              initial={{ scale: 0.3, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 16 }}
            >
              <Check size={38} strokeWidth={3} />
            </motion.div>
            <div className={`display ${s.resultTitle}`}>Verified</div>
            <div className={s.resultEvent}>{title}</div>
            {event.data && <div className={`num ${s.resultPoints}`}>+{event.data.pointsOnVerify}</div>}
            <div className="label">MovePoints</div>
            <Link to="/" className={s.linkish}>
              Back to Home
            </Link>
          </>
        )}
        {status === 'rejected' && (
          <>
            <div className={`${s.resultIcon} ${s.rejectedIcon}`}>
              <X size={32} />
            </div>
            <div className={`display ${s.resultTitle}`}>Not approved</div>
            <div className={s.resultEvent}>{title}</div>
            <p className="muted">Talk to the organiser at the venue.</p>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
