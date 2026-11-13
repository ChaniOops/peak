import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState, type ReactNode } from 'react'
import { Check, Pause, Play, Square, Trash2 } from 'lucide-react'
import { elapsedMs, useSession, USES } from '../../tracking/sessionStore'
import { useNow } from '../../lib/useNow'
import { ACTIVITY_LABEL, formatDuration, formatKm, formatNumber, formatPace, formatSpeed } from '../../lib/format'
import { Button, Chip, IconButton, Notice, type Tone } from '../../components/ui/ui'
import { RollingNumber } from '../../components/ui/RollingNumber'
import { BlurReplace } from '../../components/ui/BlurReplace'
import type { GpsStatus } from '../../sensors/geolocation'
import type { MotionStatus } from '../../sensors/motion'
import { RouteMap } from '../../components/map/RouteMap'
import { SPRING_POP } from '../../lib/motion'
import s from './track.module.css'

export function LiveSession() {
  const st = useSession()
  const now = useNow(1000, st.phase === 'active')
  const sec = elapsedMs(st, now) / 1000
  const uses = USES[st.type]
  const paused = st.phase === 'paused'

  // live numbers roll (transform-only odometer: no layout, no canvas work)
  const roll = (n: number, f: (v: number) => string) => <RollingNumber value={n} format={f} />
  const primary =
    st.type === 'walk'
      ? { value: roll(st.steps, formatNumber), unit: 'steps' }
      : { value: roll(st.distanceM, formatKm), unit: 'km' }

  const secondary: Array<{ label: string; value: ReactNode; unit?: string }> =
    st.type === 'walk'
      ? [
          { label: 'Time', value: roll(sec, formatDuration) },
          { label: 'Distance', value: roll(st.distanceM, formatKm), unit: 'km' },
          { label: 'Pace /km', value: formatPace(st.distanceM, sec) },
        ]
      : st.type === 'run'
        ? [
            { label: 'Time', value: roll(sec, formatDuration) },
            { label: 'Pace /km', value: formatPace(st.distanceM, sec) },
            { label: 'Steps', value: roll(st.steps, formatNumber) },
          ]
        : [
            { label: 'Time', value: roll(sec, formatDuration) },
            { label: 'Avg speed', value: formatSpeed(st.distanceM, sec), unit: 'km/h' },
            { label: 'Points', value: String(st.route.length), unit: 'fixes' },
          ]

  return (
    <div className={s.live}>
      <div className={s.liveMap}>
        <RouteMap route={st.route} follow />
        <div className={s.liveChips}>
          <Chip tone="accent" dot glass>
            {ACTIVITY_LABEL[st.type]} · {paused ? 'paused' : 'live'}
          </Chip>
          {uses.gps && <GpsChip status={st.gps} accuracy={st.gpsAccuracy} />}
          {uses.motion && <MotionChip status={st.motion} />}
          {st.simulated && (
            <Chip tone="ember" glass>
              Simulated
            </Chip>
          )}
        </div>
      </div>

      <div className={s.primary}>
        <AnimatePresence>
          {paused && (
            <motion.div
              className={s.pausedTag}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <Chip tone="ember">Paused</Chip>
            </motion.div>
          )}
        </AnimatePresence>
        <div className={`num ${s.primaryValue} ${paused ? s.dim : ''}`}>{primary.value}</div>
        <div className="label">{primary.unit}</div>
      </div>

      <div className={`${s.liveStats} pg-hero`}>
        {secondary.map((x) => (
          <div key={x.label} className={s.secondaryCell}>
            <div className={`num ${s.secondaryValue}`}>
              {x.value}
              {x.unit && <span className={s.secondaryUnit}>{x.unit}</span>}
            </div>
            <div className="label">{x.label}</div>
          </div>
        ))}
      </div>

      {st.motion === 'denied' && uses.motion && (
        <div className={s.gap}>
          <Notice tone="ember">
            <strong>Motion access denied.</strong> Steps aren’t counted; GPS still records distance.
          </Notice>
        </div>
      )}
      {st.gps === 'denied' && uses.gpsPrimary && (
        <div className={s.gap}>
          <Notice tone="ember">
            <strong>Location is off.</strong> Enable it in browser settings to record distance.
          </Notice>
        </div>
      )}

      <div className={s.controls}>
        <AnimatePresence initial={false}>
          {paused && (
            <motion.div key="discard" className={s.ctlSlot} {...sideIn(-1)}>
              <IconButton label="Discard" variant="secondary" size={56} onClick={st.discard}>
                <Trash2 size={19} />
              </IconButton>
            </motion.div>
          )}
        </AnimatePresence>
        {/* one control that changes material: white glass to pause, live lime to resume */}
        <IconButton
          label={paused ? 'Resume' : 'Pause'}
          variant={paused ? 'live' : 'contrast'}
          size={80}
          className={s.ctlMain}
          onClick={paused ? st.resume : st.pause}
        >
          <BlurReplace id={paused ? 'play' : 'pause'}>
            {paused ? <Play size={26} fill="currentColor" /> : <Pause size={26} fill="currentColor" />}
          </BlurReplace>
        </IconButton>
        <AnimatePresence initial={false}>
          {paused && (
            <motion.div key="finish" className={s.ctlSlot} {...sideIn(1)}>
              <FinishControl onFinish={() => void st.finish()} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className={s.ctlHint}>
        <BlurReplace id={paused ? 'p' : 'a'}>{paused ? 'Resume, finish, or discard' : 'Pause to finish'}</BlurReplace>
      </p>
    </div>
  )
}

/**
 * Finish is two taps: the first turns the square into a "Finish?" check that
 * waits three seconds, so one stray tap can't end a demo session.
 */
function FinishControl({ onFinish }: { onFinish: () => void }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = window.setTimeout(() => setArmed(false), 3000)
    return () => window.clearTimeout(t)
  }, [armed])
  return (
    <motion.div layout transition={SPRING_POP} className={s.finishWrap}>
      {armed ? (
        <Button variant="contrast" size="lg" className={s.finishArmed} onClick={onFinish} aria-label="Confirm finish">
          <Check size={18} strokeWidth={2.6} />
          <BlurReplace id="armed">Finish</BlurReplace>
        </Button>
      ) : (
        <IconButton label="Finish" variant="contrast" size={56} onClick={() => setArmed(true)}>
          <Square size={17} fill="currentColor" />
        </IconButton>
      )}
    </motion.div>
  )
}

/** paused-state side controls slide out from under the main button */
const sideIn = (dir: -1 | 1) => ({
  initial: { opacity: 0, x: -dir * 28, scale: 0.8 },
  animate: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: -dir * 28, scale: 0.8, transition: { duration: 0.16 } },
  transition: SPRING_POP,
})

function GpsChip({ status, accuracy }: { status: GpsStatus; accuracy: number | null }) {
  const map: Record<GpsStatus, [Tone, string]> = {
    off: ['neutral', 'GPS off'],
    acquiring: ['ember', 'GPS searching'],
    ok: ['ice', `GPS ±${Math.round(accuracy ?? 0)} m`],
    weak: ['ember', `GPS weak ±${Math.round(accuracy ?? 0)} m`],
    denied: ['danger', 'GPS denied'],
    unavailable: ['danger', 'GPS unavailable'],
  }
  const [tone, text] = map[status]
  return (
    <Chip tone={tone} dot glass>
      <BlurReplace id={status} origin="left center">
        {text}
      </BlurReplace>
    </Chip>
  )
}

function MotionChip({ status }: { status: MotionStatus }) {
  const map: Record<MotionStatus, [Tone, string]> = {
    off: ['neutral', 'Motion off'],
    waiting: ['ember', 'Motion…'],
    ok: ['ice', 'Motion'],
    denied: ['danger', 'Motion denied'],
    unavailable: ['danger', 'No motion sensor'],
  }
  const [tone, text] = map[status]
  return (
    <Chip tone={tone} dot glass>
      <BlurReplace id={status} origin="left center">
        {text}
      </BlurReplace>
    </Chip>
  )
}
