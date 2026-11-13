import { motion } from 'framer-motion'
import { Award, Check, Mountain } from 'lucide-react'
import { useSession, elapsedMs } from '../../tracking/sessionStore'
import { ACTIVITY_LABEL, formatDuration, formatKm, formatNumber, formatPace } from '../../lib/format'
import { AnimatedNumber } from '../../components/ui/AnimatedNumber'
import { Button, ButtonLink, Chip, Notice, Spinner } from '../../components/ui/ui'
import { EASE_OUT } from '../../lib/motion'
import { RouteMap } from '../../components/map/RouteMap'
import s from './track.module.css'

export function SessionSummary() {
  const st = useSession()
  const sec = elapsedMs(st) / 1000

  if (st.phase === 'saving') {
    return (
      <div className={s.saving}>
        <Spinner size={24} />
        <div className="label">Saving to campus</div>
      </div>
    )
  }

  if (st.phase === 'error') {
    return (
      <div className={s.saving}>
        <Notice tone="danger">
          <strong>Couldn’t save.</strong> {st.error}
        </Notice>
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
  const route = st.route
  const result = st.result
  return (
    <div className={s.summary}>
      <div className={s.summaryHead}>
        <Chip tone="accent">
          <Check size={11} strokeWidth={3} /> {ACTIVITY_LABEL[st.type]} saved
        </Chip>
        {st.simulated && <Chip tone="ember">Simulated</Chip>}
      </div>

      <motion.div
        className={`${s.pointsHero} pg-hero`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE_OUT }}
      >
        <div className={`num ${s.pointsValue}`}>
          +<AnimatedNumber value={result?.pointsAwarded ?? 0} from={0} duration={1.2} />
        </div>
        <div className="label">MovePoints awarded</div>
        {result && result.breakdown.length > 1 && (
          <div className={s.breakdown}>
            {result.breakdown.map((b) => (
              <span key={b.label}>
                {b.label} <strong>+{b.points}</strong>
              </span>
            ))}
          </div>
        )}
        {result && result.pointsAwarded === 0 && (
          <p className={s.zeroNote}>Short sessions don’t earn points. Keep moving a little longer next time.</p>
        )}
      </motion.div>

      {result && result.completedChallenges.length > 0 && (
        <div className={s.completed}>
          {result.completedChallenges.map((t) => (
            <Chip key={t} tone="accent">
              Completed · {t}
            </Chip>
          ))}
        </div>
      )}

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

      {result && result.badgesEarned.length > 0 && (
        <div className={s.badgesEarned}>
          {result.badgesEarned.map((b, i) => (
            <motion.div
              key={b.id}
              className={s.badgeEarned}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + i * 0.12, duration: 0.45, ease: EASE_OUT }}
            >
              <span className={s.badgeIcon}>
                <Award size={18} />
              </span>
              <div>
                <strong>{b.name}</strong>
                <div className="muted">{b.description}</div>
              </div>
              <span className="label">Badge</span>
            </motion.div>
          ))}
        </div>
      )}

      <div className={s.row}>
        <ButtonLink to="/compete" onClick={st.discard} variant="secondary" size="lg">
          <Mountain size={16} /> See summit
        </ButtonLink>
        <Button size="lg" onClick={st.discard}>
          Done
        </Button>
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
