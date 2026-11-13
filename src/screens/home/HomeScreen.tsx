import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { EASE_OUT } from '../../lib/motion'
import { Zap, ArrowRight, Footprints, ChevronRight } from 'lucide-react'
import { api } from '../../api'
import { useLive } from '../../api/useLive'
import { ErrorNote, Section, Skeleton } from '../../components/ui/ui'
import { buttonClass, glassLight } from '../../components/ui/buttonClass'
import { RollingNumber } from '../../components/ui/RollingNumber'
import { StreakStrip } from '../../components/StreakStrip'
import { FeedList } from '../../components/FeedList'
import { ChallengeRow } from '../../components/ChallengeRow'
import { SummitCard } from '../../components/summit/SummitCard'
import { formatDistance } from '../../lib/format'
import { isLive, useSession } from '../../tracking/sessionStore'
import s from './home.module.css'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening'
}

export function HomeScreen() {
  const me = useLive('me', () => api.getMe(), ['profile'])
  const today = useLive('today', () => api.getToday(), ['today'])
  const streak = useLive('streak', () => api.getStreak(), ['today'])
  const summit = useLive('summit', () => api.getSummit(), ['summit'])
  const challenges = useLive('challenges', () => api.listChallenges(), ['challenges'])
  const feed = useLive('feed', () => api.getFeed(8), ['feed'])
  const live = isLive(useSession((st) => st.phase))

  const first = me.data?.displayName.split(' ')[0]

  return (
    <div>
      <header className={s.header}>
        <div className={s.hello}>
          <div className="label">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
          </div>
          <h1 className={`display ${s.helloText}`}>
            <span className={s.helloGreeting}>{greeting()},</span>
            {first && <span>{first}</span>}
          </h1>
        </div>
        <Link to="/you" className={s.balance} aria-label="MovePoints balance">
          <Zap size={13} fill="currentColor" className={s.balanceIcon} />
          <span className="num">{me.data ? <RollingNumber value={me.data.movePoints} /> : '–'}</span>
          <ChevronRight size={14} className={s.balanceChevron} />
        </Link>
      </header>

      {/* Today: no card — precise numbers sitting on the atmosphere */}
      <section className={s.today} aria-label="Today">
        {today.data ? (
          <>
            <div className={s.todayHead}>
              <span className="label">Steps today</span>
            </div>
            <div className={`num ${s.todaySteps}`}>
              <RollingNumber value={today.data.steps} />
            </div>
            <div className={s.metrics}>
              <div className={s.metric}>
                <span className={`num ${s.metricValue}`}>{formatDistance(today.data.distanceM)}</span>
                <span className="label">Distance</span>
              </div>
              <div className={s.metric}>
                <span className={`num ${s.metricValue}`}>
                  <RollingNumber value={today.data.activeMinutes} />
                  <span className={s.metricUnit}>min</span>
                </span>
                <span className="label">Active</span>
              </div>
              <div className={s.metric}>
                <span className={`num ${s.metricValue} ${s.metricPositive}`}>
                  +<RollingNumber value={today.data.movePoints} />
                </span>
                <span className="label">MovePoints</span>
              </div>
            </div>
          </>
        ) : today.error ? (
          <ErrorNote error={today.error} onRetry={today.reload} />
        ) : (
          <Skeleton h={150} />
        )}
        {streak.data && me.data && (
          <div className={s.streak}>
            <StreakStrip days={streak.data} streakDays={me.data.streakDays} />
          </div>
        )}
      </section>

      <Link
        to="/track"
        className={buttonClass({ variant: live ? 'secondary' : 'primary', size: 'xl', block: true }, `${s.cta} ${live ? s.ctaLive : ''}`)}
        {...glassLight}
      >
        <span className={s.ctaIcon}>
          {live ? <span className={s.liveDot} aria-hidden /> : <Footprints size={19} strokeWidth={2} />}
        </span>
        <span className={s.ctaText}>
          <span className={s.ctaTitle}>{live ? 'Session recording' : 'Start moving'}</span>
          <span className={s.ctaSub}>{live ? 'Return to your live activity' : 'Walk, run or ride. Every step climbs.'}</span>
        </span>
        <ArrowRight size={18} className={s.ctaArrow} />
      </Link>

      <Section title="Weekly summit" action={{ to: '/compete', label: 'Compete' }}>
        {summit.data ? (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '0px 0px -10% 0px' }}
            transition={{ duration: 0.6, ease: EASE_OUT }}
          >
            <SummitCard summit={summit.data} compact />
          </motion.div>
        ) : (
          <Skeleton h={340} />
        )}
      </Section>

      {challenges.data && challenges.data.some((c) => c.joined) && (
        <Section title="Your challenges" action={{ to: '/compete', label: 'All' }}>
          <div className={s.stack}>
            {challenges.data
              .filter((c) => c.joined)
              .slice(0, 2)
              .map((c) => (
                <ChallengeRow key={c.id} c={c} />
              ))}
          </div>
        </Section>
      )}

      {/* backend has no campus-wide feed yet; in Supabase mode this is your own ledger */}
      <Section title={api.mode === 'mock' ? 'Campus, live' : 'Your latest'}>
        {feed.data ? <FeedList items={feed.data} /> : <Skeleton h={240} />}
      </Section>
    </div>
  )
}
