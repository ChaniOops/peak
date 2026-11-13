import { motion } from 'framer-motion'
import { Footprints, Bike, Activity, Smartphone, Satellite, Sun } from 'lucide-react'
import type { TrackedActivityType } from '../../api/types'
import { api } from '../../api'
import { useSession, USES } from '../../tracking/sessionStore'
import { ScreenHeader } from '../../components/ui/ui'
import { motionSupported } from '../../sensors/motion'
import { geolocationSupported } from '../../sensors/geolocation'
import { TopoLines } from '../../components/topo/TopoLines'
import s from './track.module.css'

const TYPES: Array<{ type: TrackedActivityType; label: string; hint: string; Icon: typeof Footprints }> = [
  { type: 'walk', label: 'Walk', hint: 'Steps · route', Icon: Footprints },
  { type: 'run', label: 'Run', hint: 'GPS · pace', Icon: Activity },
  { type: 'cycle', label: 'Cycle', hint: 'GPS · speed', Icon: Bike },
]

export function TrackSetup() {
  const type = useSession((st) => st.type)
  const setType = useSession((st) => st.setType)
  const start = useSession((st) => st.start)
  const uses = USES[type]
  const sensorsMissing = !window.isSecureContext || !motionSupported() || !geolocationSupported()
  const offerSimulation = api.mode === 'mock' || sensorsMissing

  return (
    <div>
      <ScreenHeader eyebrow="Live activity" title="Track" />

      <div className={s.types}>
        {TYPES.map(({ type: t, label, hint, Icon }) => (
          <button key={t} className={s.typeTile} onClick={() => setType(t)} aria-pressed={t === type}>
            {t === type && (
              <motion.span
                layoutId="type-sel"
                className={s.typeSel}
                transition={{ type: 'spring', stiffness: 420, damping: 36 }}
              />
            )}
            <Icon size={24} strokeWidth={1.8} className={s.typeIcon} />
            <span className={`display ${s.typeLabel}`}>{label}</span>
            <span className="label">{hint}</span>
          </button>
        ))}
      </div>

      <div className={s.sensorPlan}>
        <SensorRow
          Icon={Smartphone}
          title="Motion"
          detail={uses.motion ? 'Counts your steps' : 'Not used for cycling'}
          state={uses.motion ? (type === 'walk' ? 'primary' : 'bonus') : 'off'}
        />
        <SensorRow
          Icon={Satellite}
          title="GPS"
          detail={uses.gpsPrimary ? 'Distance, pace and route' : 'Draws your route if allowed'}
          state={uses.gpsPrimary ? 'primary' : 'optional'}
        />
      </div>

      <div className={s.startWrap}>
        <TopoLines className={s.startTopo} seed={7} rings={9} />
        <motion.button
          className={s.startBtn}
          whileTap={{ scale: 0.94 }}
          onClick={() => void start()}
          aria-label={`Start ${type}`}
        >
          <span className={s.startPulse} />
          <span className="display">Start</span>
        </motion.button>
      </div>

      <p className={s.wakeNote}>
        <Sun size={14} /> Keep the screen on while tracking. Phones pause sensors in the browser when the screen
        locks.
      </p>

      {offerSimulation && (
        <button className={s.simLink} onClick={() => void start({ simulate: true })}>
          {sensorsMissing ? 'Sensors unavailable here.' : 'Indoors?'} Run a simulated session
        </button>
      )}
    </div>
  )
}

function SensorRow({
  Icon,
  title,
  detail,
  state,
}: {
  Icon: typeof Smartphone
  title: string
  detail: string
  state: 'primary' | 'bonus' | 'optional' | 'off'
}) {
  return (
    <div className={`${s.sensorRow} ${state === 'off' ? s.sensorOff : ''}`}>
      <Icon size={18} strokeWidth={1.8} />
      <div className={s.sensorText}>
        <strong>{title}</strong>
        <span className="muted">{detail}</span>
      </div>
      <span className="label">{state}</span>
    </div>
  )
}
