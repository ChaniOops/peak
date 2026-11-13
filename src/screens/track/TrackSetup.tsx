import { motion } from 'framer-motion'
import { Footprints, Bike, Activity, Smartphone, Satellite, Sun, Play, FlaskConical } from 'lucide-react'
import type { TrackedActivityType } from '../../api/types'
import { api } from '../../api'
import { useSession, USES } from '../../tracking/sessionStore'
import { Button, Chip, List, ListRow, Notice, ScreenHeader, type Tone } from '../../components/ui/ui'
import { motionSupported } from '../../sensors/motion'
import { geolocationSupported } from '../../sensors/geolocation'
import { ACTIVITY_LABEL } from '../../lib/format'
import { SPRING_SLIDE } from '../../lib/motion'
import s from './track.module.css'

const TYPES: Array<{ type: TrackedActivityType; label: string; hint: string; Icon: typeof Footprints }> = [
  { type: 'walk', label: 'Walk', hint: 'Steps · route', Icon: Footprints },
  { type: 'run', label: 'Run', hint: 'GPS · pace', Icon: Activity },
  { type: 'cycle', label: 'Cycle', hint: 'GPS · speed', Icon: Bike },
]

const PLAN_TONE: Record<'primary' | 'bonus' | 'optional' | 'off', Tone> = {
  primary: 'ice',
  bonus: 'neutral',
  optional: 'neutral',
  off: 'neutral',
}

export function TrackSetup() {
  const type = useSession((st) => st.type)
  const setType = useSession((st) => st.setType)
  const start = useSession((st) => st.start)
  const phase = useSession((st) => st.phase)
  const startError = useSession((st) => st.startError)
  const uses = USES[type]
  const sensorsMissing = !window.isSecureContext || !motionSupported() || !geolocationSupported()
  // Simulated sessions never reach the real backend.
  const offerSimulation = api.mode === 'mock'
  const motionState = uses.motion ? (type === 'walk' ? 'primary' : 'bonus') : 'off'
  const gpsState = uses.gpsPrimary ? 'primary' : 'optional'

  return (
    <div>
      <ScreenHeader eyebrow="Live activity" title="Track" />

      <div className={s.types} role="radiogroup" aria-label="Activity type">
        {TYPES.map(({ type: t, label, hint, Icon }) => {
          const on = t === type
          return (
            <button key={t} role="radio" aria-checked={on} className={`${s.typeTile} ${on ? s.typeOn : ''}`} onClick={() => setType(t)}>
              {on && <motion.span layoutId="type-sel" className={s.typeSel} transition={SPRING_SLIDE} />}
              <span className={s.typeIcon}>
                <Icon size={18} strokeWidth={1.9} />
              </span>
              <span className={s.typeLabel}>{label}</span>
              <span className={`label ${s.typeHint}`}>{hint}</span>
            </button>
          )
        })}
      </div>

      <List className={s.sensorPlan}>
        <ListRow
          className={motionState === 'off' ? s.sensorOff : ''}
          leading={<span className={s.sensorIcon}><Smartphone size={16} strokeWidth={1.8} /></span>}
          title="Motion"
          meta={uses.motion ? 'Counts your steps' : 'Not used for cycling'}
          trailing={<Chip tone={PLAN_TONE[motionState]}>{motionState}</Chip>}
        />
        <ListRow
          leading={<span className={s.sensorIcon}><Satellite size={16} strokeWidth={1.8} /></span>}
          title="GPS"
          meta={uses.gpsPrimary ? 'Distance, pace and route' : 'Draws your route if allowed'}
          trailing={<Chip tone={PLAN_TONE[gpsState]}>{gpsState}</Chip>}
        />
      </List>

      {startError && (
        <div className={s.gap}>
          <Notice tone="danger">{startError}</Notice>
        </div>
      )}

      <Button
        size="xl"
        block
        className={s.startBtn}
        onClick={() => void start()}
        loading={phase === 'starting'}
        aria-label={`Start ${type}`}
      >
        {phase !== 'starting' && <Play size={17} fill="currentColor" />}
        {phase === 'starting' ? 'Starting sensors…' : `Start ${ACTIVITY_LABEL[type].toLowerCase()}`}
      </Button>

      <div className={s.gap}>
        <Notice icon={<Sun size={15} />}>Keep the screen on while tracking. Phones pause browser sensors when the screen locks.</Notice>
      </div>

      {offerSimulation && (
        <div className={s.simWrap}>
          <Button variant="ghost" size="sm" onClick={() => void start({ simulate: true })}>
            <FlaskConical size={14} />
            {sensorsMissing ? 'Sensors unavailable here · run a simulation' : 'Indoors? Run a simulated session'}
          </Button>
        </div>
      )}
    </div>
  )
}
