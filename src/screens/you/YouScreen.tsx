import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Activity as RunIcon, Award, Bike, Footprints, Gift, Lock, LogOut, RotateCcw, Ticket, Zap, ExternalLink } from 'lucide-react'
import { api, ApiError } from '../../api'
import { useLive } from '../../api/useLive'
import type { Badge, Reward, TrackedActivityType } from '../../api/types'
import { Button, Chip, EmptyState, ErrorNote, List, ListRow, ProgressBar, Section, Skeleton } from '../../components/ui/ui'
import { Avatar } from '../../components/ui/Avatar'
import { AnimatedNumber } from '../../components/ui/AnimatedNumber'
import { WeeklyChart } from '../../components/charts/WeeklyChart'
import { useAuth } from '../../app/auth'
import { ACTIVITY_LABEL, formatDistance, formatDuration, formatNumber, timeAgo } from '../../lib/format'
import { EASE_OUT, SPRING_POP } from '../../lib/motion'
import s from './you.module.css'

const TYPE_ICON: Record<TrackedActivityType, typeof Footprints> = { walk: Footprints, run: RunIcon, cycle: Bike }

export function YouScreen() {
  const me = useLive('me', () => api.getMe(), ['profile'])
  const weekly = useLive('weekly', () => api.getWeekly(), ['today'])
  const badges = useLive('badges', () => api.listBadges(), ['badges'])
  const activities = useLive('activities', () => api.listActivities(10), ['activities'])
  const rewards = useLive('rewards', () => api.listRewards(), ['rewards'])
  const redemptions = useLive('redemptions', () => api.listRedemptions(), ['rewards'])

  const earned = badges.data?.filter((b) => b.earnedAt).length

  return (
    <div>
      {me.data ? (
        <header className={s.profile}>
          <Avatar name={me.data.displayName} size={56} />
          <div className={s.who}>
            <h1 className={`display ${s.name}`}>{me.data.displayName}</h1>
            <div className="label">{me.data.departmentName}</div>
          </div>
        </header>
      ) : me.error ? (
        <ErrorNote error={me.error} onRetry={me.reload} />
      ) : (
        <Skeleton h={80} />
      )}

      {me.data && (
        <div className={`${s.balance} pg-hero`}>
          <div className={s.balanceMain}>
            <div className="label">MovePoints balance</div>
            <div className={`num ${s.balanceValue}`}>
              <Zap size={22} fill="currentColor" className={s.zap} />
              <AnimatedNumber value={me.data.movePoints} />
            </div>
          </div>
          <div className={s.balanceStats}>
            <div className={s.balanceStat}>
              <span className="num">{me.data.streakDays}</span>
              <span className="label">Day streak</span>
            </div>
            <div className={s.balanceStat}>
              <span className="num">
                {earned ?? '–'}
                {badges.data && <span className={s.of}>/{badges.data.length}</span>}
              </span>
              <span className="label">Badges</span>
            </div>
          </div>
        </div>
      )}

      <Section title="Movement">
        {weekly.data ? <WeeklyChart days={weekly.data} /> : weekly.error ? <ErrorNote error={weekly.error} onRetry={weekly.reload} /> : <Skeleton h={230} />}
      </Section>

      <Section title="Badges">
        {badges.data ? <BadgeGrid badges={badges.data} /> : <Skeleton h={200} />}
      </Section>

      <Section title="Recent activity">
        {activities.data ? (
          activities.data.length ? (
            <List>
              {activities.data.map((a) => {
                const Icon = TYPE_ICON[a.type]
                return (
                  <ListRow
                    key={a.id}
                    leading={
                      <span className={s.rowIcon}>
                        <Icon size={16} />
                      </span>
                    }
                    title={
                      <>
                        {ACTIVITY_LABEL[a.type]}
                        <span className={s.rowDetail}>
                          {a.type === 'walk' && a.steps ? `${formatNumber(a.steps)} steps` : formatDistance(a.distanceM)}
                        </span>
                      </>
                    }
                    meta={`${formatDuration(a.durationSec)} · ${timeAgo(a.endedAt ?? a.startedAt)}`}
                    trailing={<span className={`num ${s.rowPts}`}>+{a.pointsAwarded}</span>}
                  />
                )
              })}
            </List>
          ) : (
            <EmptyState icon={<Footprints size={18} />} title="Nothing tracked yet" body="Start a walk, run or ride from Track." />
          )
        ) : (
          <Skeleton h={120} />
        )}
      </Section>

      <Section title="Rewards" meta={me.data && <span className="label">{formatNumber(me.data.movePoints)} pts available</span>}>
        {rewards.data ? (
          rewards.data.length ? (
            <div className={s.rewards}>
              {rewards.data.map((r) => (
                <RewardCard key={r.id} r={r} balance={me.data?.movePoints ?? 0} />
              ))}
            </div>
          ) : (
            <EmptyState icon={<Gift size={18} />} title="No rewards yet" body="Campus partners add rewards here." />
          )
        ) : rewards.error ? (
          <ErrorNote error={rewards.error} onRetry={rewards.reload} />
        ) : (
          <Skeleton h={200} />
        )}
        {redemptions.data && redemptions.data.length > 0 && (
          <>
            <div className={`label ${s.subhead}`}>Redeemed</div>
            <List>
              {redemptions.data.map((r) => (
                <ListRow
                  key={r.id}
                  leading={
                    <span className={s.rowIcon}>
                      <Ticket size={16} />
                    </span>
                  }
                  title={r.rewardTitle}
                  meta={`${r.status === 'fulfilled' ? 'Fulfilled' : 'Requested'} · ${timeAgo(r.createdAt)}`}
                  trailing={r.code && <code className={s.code}>{r.code}</code>}
                />
              ))}
            </List>
          </>
        )}
      </Section>

      <AccountSection />
    </div>
  )
}

function BadgeGrid({ badges }: { badges: Badge[] }) {
  return (
    <div className={s.badges}>
      {badges.map((b, i) => {
        const earned = Boolean(b.earnedAt)
        return (
          <motion.div
            key={b.id}
            className={`${s.badge} ${earned ? s.earned : ''}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03, duration: 0.4, ease: EASE_OUT }}
            title={b.description}
          >
            <span className={s.badgeIcon}>{earned ? <Award size={18} /> : <Lock size={14} />}</span>
            <span className={s.badgeName}>{b.name}</span>
            <span className={s.badgeCat}>{earned ? (b.category ?? 'Earned') : 'Locked'}</span>
          </motion.div>
        )
      })}
    </div>
  )
}

function RewardCard({ r, balance }: { r: Reward; balance: number }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const short = Math.max(0, r.cost - balance)

  async function redeem() {
    setBusy(true)
    setError(null)
    try {
      await api.redeemReward(r.id)
      setConfirming(false)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not redeem')
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className={`${s.reward} ${r.canRedeem ? s.rewardReady : ''}`}>
      <div className={s.rewardTop}>
        <span className={s.rewardIcon}>
          <Gift size={17} />
        </span>
        <div className={s.rewardText}>
          <h3 className={s.rewardTitle}>{r.title}</h3>
          <p className={s.rewardDesc}>{error ?? r.blockedReason ?? r.description}</p>
        </div>
        <span className={s.cost}>
          <Zap size={11} fill="currentColor" />
          <span className="num">{formatNumber(r.cost)}</span>
        </span>
      </div>

      <div className={s.rewardFoot}>
        {r.canRedeem ? (
          <AnimatePresence mode="wait" initial={false}>
            {confirming ? (
              <motion.div key="confirm" className={s.confirm} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={SPRING_POP}>
                <span className={s.confirmText}>Spend {formatNumber(r.cost)} points?</span>
                <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
                  Cancel
                </Button>
                <Button size="sm" onClick={() => void redeem()} loading={busy}>
                  Confirm
                </Button>
              </motion.div>
            ) : (
              <motion.div key="ready" className={s.confirm} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <span className={s.ready}>Ready to redeem</span>
                <Button size="sm" onClick={() => setConfirming(true)}>
                  Redeem
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        ) : (
          <div className={s.saving}>
            <ProgressBar value={balance / r.cost} tone="neutral" />
            <span className={s.savingText}>{short > 0 ? `${formatNumber(short)} more points` : 'Unavailable'}</span>
          </div>
        )}
      </div>
    </article>
  )
}

function AccountSection() {
  const { signOut } = useAuth()
  const events = useLive('events', () => api.listEvents(), ['events'])
  return (
    <Section title={api.mode === 'mock' ? 'Demo' : 'Account'}>
      <div className={s.account}>
        {api.mode === 'mock' && (
          <>
            <p className={s.demoNote}>
              <Chip tone="ember">Mock data</Chip> Organiser views for the verification demo. Open in another tab.
            </p>
            <ul className={s.orgLinks}>
              {events.data?.map((e) => (
                <li key={e.id}>
                  <Link to={`/organiser/event/${e.id}`} target="_blank">
                    {e.title} <ExternalLink size={12} />
                  </Link>
                </li>
              ))}
            </ul>
            <Button variant="secondary" size="sm" onClick={() => void api.resetDemo?.()}>
              <RotateCcw size={14} /> Reset demo data
            </Button>
          </>
        )}
        <Button variant="ghost" size="sm" className={s.signOut} onClick={() => void signOut()}>
          <LogOut size={14} /> Sign out
        </Button>
      </div>
    </Section>
  )
}
