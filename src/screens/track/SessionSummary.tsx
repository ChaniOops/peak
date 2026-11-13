import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Award, Loader2 } from 'lucide-react'
import { useSession, elapsedMs } from '../../tracking/sessionStore'
import { ACTIVITY_LABEL, formatDuration, formatKm, formatNumber, formatPace } from '../../lib/format'
import { AnimatedNumber } from '../../components/ui/AnimatedNumber'
import { Button, Chip } from '../../components/ui/ui'
import { RouteMap } from '../../components/map/RouteMap'
import s from './track.module.css'

export function SessionSummary() {
  const st = useSession()
  const sec = elapsedMs(st) / 1000
  const activity = st.result?.activity

  if (st.phase === 'saving') {
    return (
      <div className={s.saving}>
        <Loader2 className={s.spin} size={28} />
        <div className="label">Saving to campus</div>
      </div>
    )
  }

  if (st.phase === 'error') {
    return (
      <div className={s.saving}>
        <div className={s.warn}>{st.error}</div>
        <p className="muted">Your session is kept on this phone until it saves.</p>
        <div className={s.row}>
          <Button variant="secondary" onClick={st.discard}>
            Discard
          </Button>
          <Button onClick={() => void st.retrySave()}>Retry save</Button>
        </div>
      </div>
    )
  }

  // saved
  const route = activity?.route ?? st.route
  return (
    <div className={s.summary}>
      <div className={s.summaryHead}>
        <Chip tone="accent">{ACTIVITY_LABEL[st.type]} saved</Chip>
        {st.simulated && <Chip tone="ember">Simulated</Chip>}
      </div>

      <motion.div
        className={s.pointsHero}
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className={`num ${s.pointsValue}`}>
          +<AnimatedNumber value={st.result?.pointsAwarded ?? 0} from={0} duration={1.2} />
        </div>
        <div className="label">MovePoints awarded</div>
      </motion.div>

      <div className={s.secondary}>
        <Cell label="Time" value={formatDuration(sec)} />
        <Cell label="Distance" value={formatKm(st.distanceM)} unit="km" />
        {st.type === 'cycle' ? (
          <Cell label="Fixes" value={String(route.length)} />
        ) : st.type === 'walk' ? (
          <Cell label="Steps" value={formatNumber(st.steps)} />
        ) : (
          <Cell label="Pace /km" value={formatPace(st.distanceM, sec)} />
        )}
      </div>

      {route.length > 1 && (
        <div className={s.summaryMap}>
          <RouteMap route={route} />
        </div>
      )}

      {st.result && st.result.badgesEarned.length > 0 && (
        <div className={s.badgesEarned}>
          {st.result.badgesEarned.map((b, i) => (
            <motion.div
              key={b.id}
              className={s.badgeEarned}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + i * 0.15 }}
            >
              <Award size={20} />
              <div>
                <strong>{b.name}</strong>
                <div className="muted">{b.description}</div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <div className={s.row}>
        <Link to="/compete" onClick={st.discard} className={s.linkBtn}>
          See summit
        </Link>
        <Button onClick={st.discard}>Done</Button>
      </div>
    </div>
  )
}

function Cell({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className={s.secondaryCell}>
      <div className={`num ${s.secondaryValue}`}>
        {value}
        {unit && <span className={s.secondaryUnit}>{unit}</span>}
      </div>
      <div className="label">{label}</div>
    </div>
  )
}
