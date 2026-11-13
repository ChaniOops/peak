import { AnimatePresence, motion } from 'framer-motion'
import { Pause, Play, Square, Trash2 } from 'lucide-react'
import { elapsedMs, useSession, USES } from '../../tracking/sessionStore'
import { useNow } from '../../lib/useNow'
import { ACTIVITY_LABEL, formatDuration, formatKm, formatNumber, formatPace, formatSpeed } from '../../lib/format'
import { Chip, type Tone } from '../../components/ui/ui'
import type { GpsStatus } from '../../sensors/geolocation'
import type { MotionStatus } from '../../sensors/motion'
import { RouteMap } from '../../components/map/RouteMap'
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
          <Chip tone="accent" dot>
            {ACTIVITY_LABEL[st.type]}
          </Chip>
          {uses.gps && <GpsChip status={st.gps} accuracy={st.gpsAccuracy} />}
          {uses.motion && <MotionChip status={st.motion} />}
          {st.simulated && <Chip tone="ember">Simulated</Chip>}
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

      <div className={s.secondary}>
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
        <p className={s.warn}>Motion access was denied, so steps aren’t counted. GPS still records distance.</p>
      )}
      {st.gps === 'denied' && uses.gpsPrimary && (
        <p className={s.warn}>Location access is off. Enable it in browser settings to record distance.</p>
      )}

      <div className={s.controls}>
        {paused ? (
          <>
            <button className={s.ctlSide} onClick={st.discard} aria-label="Discard">
              <Trash2 size={20} />
            </button>
            <motion.button whileTap={{ scale: 0.94 }} className={s.ctlMain} onClick={st.resume}>
              <Play size={26} fill="currentColor" />
            </motion.button>
            <button className={`${s.ctlSide} ${s.ctlFinish}`} onClick={() => void st.finish()} aria-label="Finish">
              <Square size={18} fill="currentColor" />
            </button>
          </>
        ) : (
          <motion.button whileTap={{ scale: 0.94 }} className={s.ctlMain} onClick={st.pause} aria-label="Pause">
            <Pause size={26} fill="currentColor" />
          </motion.button>
        )}
      </div>
      <p className={s.ctlHint}>{paused ? 'Resume, finish, or discard' : 'Pause to finish'}</p>
    </div>
  )
}

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
    <Chip tone={tone} dot>
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
    <Chip tone={tone} dot>
      {text}
    </Chip>
  )
}
