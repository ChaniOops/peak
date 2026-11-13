import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, Hourglass, X } from 'lucide-react'
import { api, ApiError } from '../../api'
import { useLive } from '../../api/useLive'
import { QrScanner } from '../../components/qr/QrScanner'
import { Button } from '../../components/ui/ui'
import { EASE_OUT } from '../../lib/motion'
import { SuccessCheck } from '../../components/ui/SuccessCheck'
import { BlurReplace } from '../../components/ui/BlurReplace'
import { RollingNumber } from '../../components/ui/RollingNumber'
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
      <div className={s.scanHead}>
        <Link to="/play" className={`${s.back} pg-tile`} aria-label="Back to Play">
          <ChevronLeft size={18} />
        </Link>
        <div>
          <div className="eyebrow">Play</div>
          <h1 className={`display ${s.scanTitle}`}>Check in</h1>
        </div>
      </div>

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
        <div className={`${s.result} pg-hero`}>
          <div className={`${s.resultIcon} ${s.pendingIcon}`}>
            <Hourglass size={30} />
          </div>
          <div className="label">Checking in…</div>
        </div>
      )}

      {phase.kind === 'error' && (
        <div className={`${s.result} pg-hero`}>
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

/**
 * Follows one check-in through pending → verified/rejected via realtime.
 * One card that changes state in place: the icon morphs, the title blur-swaps
 * and a three-step track fills, so the change reads without explanation.
 */
function CheckInStatus({ checkInId, eventId }: { checkInId: string; eventId: string }) {
  const mine = useLive('my-checkins', () => api.listMyCheckIns(), ['checkins'])
  const event = useLive(`event:${eventId}`, () => api.getEvent(eventId), ['events'])
  const ci = mine.data?.find((c) => c.id === checkInId)
  const status = ci?.status ?? 'pending'
  const title = ci?.eventTitle ?? event.data?.title ?? ''
  const heading = status === 'verified' ? 'Verified' : status === 'rejected' ? 'Not approved' : 'Pending verification'
  const note =
    status === 'verified'
      ? 'Your organiser confirmed you were here.'
      : status === 'rejected'
        ? 'Talk to the organiser at the venue.'
        : 'Waiting for the organiser to confirm you.'

  return (
    <motion.div
      className={`${s.result} pg-hero`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE_OUT }}
    >
      <div className={s.resultIconSlot}>
        <AnimatePresence mode="popLayout" initial={false}>
          {status === 'verified' ? (
            <motion.span key="ok" exit={{ opacity: 0, scale: 0.8 }}>
              <SuccessCheck size={68} />
            </motion.span>
          ) : status === 'rejected' ? (
            <motion.span
              key="no"
              className={`${s.resultIcon} ${s.rejectedIcon}`}
              initial={{ opacity: 0, scale: 0.5, filter: 'blur(4px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', x: [0, -6, 5, -3, 0] }}
              transition={{ duration: 0.45, ease: EASE_OUT }}
            >
              <X size={30} />
            </motion.span>
          ) : (
            <motion.span
              key="wait"
              className={`${s.resultIcon} ${s.pendingIcon}`}
              exit={{ opacity: 0, scale: 0.6, filter: 'blur(6px)', transition: { duration: 0.2 } }}
            >
              <span className={s.pendingRing} aria-hidden />
              <Hourglass size={26} />
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className={`display ${s.resultTitle}`}>
        <BlurReplace id={status}>{heading}</BlurReplace>
      </div>
      <div className={s.resultEvent}>{title}</div>

      <CheckInSteps status={status} />

      <p className={`muted ${s.resultNote}`}>
        <BlurReplace id={status}>{note}</BlurReplace>
      </p>

      <AnimatePresence>
        {status === 'verified' && event.data && (
          <motion.div
            className={s.resultPoints}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.45, ease: EASE_OUT }}
          >
            <span className="num">
              +<RollingNumber value={event.data.pointsOnVerify} />
            </span>
            <span className="label">MovePoints</span>
          </motion.div>
        )}
      </AnimatePresence>

      {status !== 'pending' && (
        <Link to="/" className={s.linkish}>
          Back to Home
        </Link>
      )}
    </motion.div>
  )
}

const STEPS = ['Checked in', 'Organiser review', 'Verified'] as const

function CheckInSteps({ status }: { status: 'pending' | 'verified' | 'rejected' }) {
  // 0: scanned, 1: under review, 2: decided
  const reached = status === 'pending' ? 1 : 2
  return (
    <ol className={s.steps} aria-label="Check-in progress">
      {STEPS.map((label, i) => {
        const done = i < reached || (i === 2 && status === 'verified')
        const active = i === reached && status === 'pending'
        const failed = i === 2 && status === 'rejected'
        return (
          <li key={label} className={`${s.step} ${done ? s.stepDone : ''} ${active ? s.stepActive : ''} ${failed ? s.stepFailed : ''}`}>
            {i > 0 && (
              <span className={s.stepLine} aria-hidden>
                <span style={{ transform: `scaleX(${i <= reached ? 1 : 0})` }} />
              </span>
            )}
            <span className={s.stepNode} aria-hidden />
            <span className={s.stepLabel}>{failed ? 'Not approved' : label}</span>
          </li>
        )
      })}
    </ol>
  )
}
