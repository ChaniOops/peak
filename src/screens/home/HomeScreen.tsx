import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Zap, ArrowUpRight, Footprints } from 'lucide-react'
import { api } from '../../api'
import { useLive } from '../../api/useLive'
import { ErrorNote, Section, Skeleton } from '../../components/ui/ui'
import { AnimatedNumber } from '../../components/ui/AnimatedNumber'
import { StreakStrip } from '../../components/StreakStrip'
import { FeedList } from '../../components/FeedList'
import { ChallengeRow } from '../../components/ChallengeRow'
import { TopoLines } from '../../components/topo/TopoLines'
import { SummitCard } from '../../components/summit/SummitCard'
import { formatDistance, formatNumber } from '../../lib/format'
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
        <div>
          <div className="label">
            {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
          </div>
          <h1 className={`display ${s.hello}`}>
            {greeting()}
            {first ? `, ${first}` : ''}
          </h1>
        </div>
        <Link to="/you" className={s.balance} aria-label="MovePoints balance">
          <Zap size={14} fill="currentColor" />
          <span className="num">{me.data ? <AnimatedNumber value={me.data.movePoints} /> : '–'}</span>
        </Link>
      </header>

      {/* Today */}
      <div className={s.today}>
        <TopoLines className={s.todayTopo} seed={3} rings={10} cx={330} cy={60} />
        {today.data ? (
          <>
            <div className="label">Steps today</div>
            <div className={`num ${s.todaySteps}`}>
              <AnimatedNumber value={today.data.steps} />
            </div>
            <div className={s.todayStats}>
              <div>
                <span className="num">{formatDistance(today.data.distanceM)}</span>
                <span className="label">distance</span>
              </div>
              <div>
                <span className="num">{today.data.activeMinutes}</span>
                <span className="label">active min</span>
              </div>
              <div>
                <span className="num">+{formatNumber(today.data.movePoints)}</span>
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
      </div>

      <motion.div whileTap={{ scale: 0.98 }}>
        <Link to="/track" className={`${s.cta} ${live ? s.ctaLive : ''}`}>
          <Footprints size={20} />
          <span>{live ? 'Session recording: return' : 'Start moving'}</span>
          <ArrowUpRight size={18} className={s.ctaArrow} />
        </Link>
      </motion.div>

      <Section title="Weekly summit" action={{ to: '/compete', label: 'Compete' }}>
        {summit.data ? <SummitCard summit={summit.data} compact /> : <Skeleton h={180} />}
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

      <Section title="Campus, live">
        {feed.data ? <FeedList items={feed.data} /> : <Skeleton h={240} />}
      </Section>
    </div>
  )
}
