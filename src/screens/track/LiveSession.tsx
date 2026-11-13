import { AnimatePresence, motion } from 'framer-motion'
import { Pause, Play, Square, Trash2 } from 'lucide-react'
import { elapsedMs, useSession, USES } from '../../tracking/sessionStore'
import { useNow } from '../../lib/useNow'
import { ACTIVITY_LABEL, formatDuration, formatKm, formatNumber, formatPace, formatSpeed } from '../../lib/format'
import { Chip, IconButton, Notice, type Tone } from '../../components/ui/ui'
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

  const primary =
    st.type === 'walk'
      ? { value: formatNumber(st.steps), unit: 'steps' }
      : { value: formatKm(st.distanceM), unit: 'km' }

  const secondary =
    st.type === 'walk'
      ? [
          { label: 'Time', value: formatDuration(sec) },
          { label: 'Distance', value: formatKm(st.distanceM), unit: 'km' },
          { label: 'Pace /km', value: formatPace(st.distanceM, sec) },
        ]
      : st.type === 'run'
        ? [
            { label: 'Time', value: formatDuration(sec) },
            { label: 'Pace /km', value: formatPace(st.distanceM, sec) },
            { label: 'Steps', value: formatNumber(st.steps) },
          ]
        : [
            { label: 'Time', value: formatDuration(sec) },
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
        {paused ? (
          <IconButton label="Resume" variant="primary" size={80} className={s.ctlMain} onClick={st.resume}>
            <Play size={26} fill="currentColor" />
          </IconButton>
        ) : (
          <IconButton label="Pause" variant="contrast" size={80} className={s.ctlMain} onClick={st.pause}>
            <Pause size={26} fill="currentColor" />
          </IconButton>
        )}
        <AnimatePresence initial={false}>
          {paused && (
            <motion.div key="finish" className={s.ctlSlot} {...sideIn(1)}>
              <IconButton label="Finish" variant="contrast" size={56} onClick={() => void st.finish()}>
                <Square size={17} fill="currentColor" />
              </IconButton>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className={s.ctlHint}>{paused ? 'Resume, finish, or discard' : 'Pause to finish'}</p>
    </div>
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
      {text}
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
      {text}
    </Chip>
  )
}
