import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Activity as RunIcon, Award, Bike, Footprints, Lock, LogOut, RotateCcw, Zap } from 'lucide-react'
import { api, ApiError } from '../../api'
import { useLive } from '../../api/useLive'
import type { Badge, Reward, TrackedActivityType } from '../../api/types'
import { Button, Chip, Empty, ErrorNote, Section, Skeleton } from '../../components/ui/ui'
import { Avatar } from '../../components/ui/Avatar'
import { AnimatedNumber } from '../../components/ui/AnimatedNumber'
import { WeeklyChart } from '../../components/charts/WeeklyChart'
import { useAuth } from '../../app/auth'
import { ACTIVITY_LABEL, formatDistance, formatDuration, formatNumber, timeAgo } from '../../lib/format'
import s from './you.module.css'

const TYPE_ICON: Record<TrackedActivityType, typeof Footprints> = { walk: Footprints, run: RunIcon, cycle: Bike }

export function YouScreen() {
  const me = useLive('me', () => api.getMe(), ['profile'])
  const weekly = useLive('weekly', () => api.getWeekly(), ['today'])
  const badges = useLive('badges', () => api.listBadges(), ['badges'])
  const activities = useLive('activities', () => api.listActivities(10), ['activities'])
  const rewards = useLive('rewards', () => api.listRewards(), ['rewards'])
  const redemptions = useLive('redemptions', () => api.listRedemptions(), ['rewards'])

  return (
    <div>
      {me.data ? (
        <header className={s.profile}>
          <Avatar name={me.data.displayName} size={60} highlight />
          <div className={s.who}>
            <h1 className={`display ${s.name}`}>{me.data.displayName}</h1>
            <div className="muted">{me.data.departmentName}</div>
          </div>
        </header>
      ) : me.error ? (
        <ErrorNote error={me.error} onRetry={me.reload} />
      ) : (
        <Skeleton h={80} />
      )}

      {me.data && (
        <div className={s.balance}>
          <div>
            <div className="label">MovePoints</div>
            <div className={`num ${s.balanceValue}`}>
              <Zap size={26} fill="currentColor" />
              <AnimatedNumber value={me.data.movePoints} />
            </div>
          </div>
          <div className={s.streak}>
            <span className="num">{me.data.streakDays}</span>
            <span className="label">day streak</span>
          </div>
        </div>
      )}

      <Section title="Movement">
        {weekly.data ? <WeeklyChart days={weekly.data} /> : <Skeleton h={220} />}
      </Section>

      <Section title="Badges">
        {badges.data ? <BadgeGrid badges={badges.data} /> : <Skeleton h={200} />}
      </Section>

      <Section title="Recent activity">
        {activities.data ? (
          activities.data.length ? (
            <ul className={s.list}>
              {activities.data.map((a) => {
                const Icon = TYPE_ICON[a.type]
                return (
                  <li key={a.id} className={s.row}>
                    <span className={s.rowIcon}>
                      <Icon size={18} />
                    </span>
                    <div className={s.rowMain}>
                      <div className={s.rowTitle}>
                        {ACTIVITY_LABEL[a.type]} ·{' '}
                        {a.type === 'walk' && a.steps ? `${formatNumber(a.steps)} steps` : formatDistance(a.distanceM)}
                        {a.sources.simulated && <span className={s.sim}>sim</span>}
                      </div>
                      <div className={s.rowMeta}>
                        {formatDuration(a.durationSec)} · {timeAgo(a.endedAt)}
                      </div>
                    </div>
                    <span className={`num ${s.rowPts}`}>+{a.pointsAwarded}</span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <Empty title="Nothing tracked yet" body="Start a walk, run or ride from Track." />
          )
        ) : (
          <Skeleton h={120} />
        )}
      </Section>

      <Section title="Rewards">
        {rewards.data ? (
          <div className={s.rewards}>
            {rewards.data.map((r) => (
              <RewardRow key={r.id} r={r} />
            ))}
          </div>
        ) : rewards.error ? (
          <ErrorNote error={rewards.error} onRetry={rewards.reload} />
        ) : (
          <Skeleton h={200} />
        )}
        {redemptions.data && redemptions.data.length > 0 && (
          <ul className={s.list} style={{ marginTop: 12 }}>
            {redemptions.data.map((r) => (
              <li key={r.id} className={s.row}>
                <div className={s.rowMain}>
                  <div className={s.rowTitle}>{r.rewardTitle}</div>
                  <div className={s.rowMeta}>
                    {r.status} · {timeAgo(r.createdAt)}
                  </div>
                </div>
                {r.code && <code className={s.code}>{r.code}</code>}
              </li>
            ))}
          </ul>
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
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            title={b.description}
          >
            <span className={s.badgeIcon}>{earned ? <Award size={22} /> : <Lock size={18} />}</span>
            <span className={s.badgeName}>{b.name}</span>
            <span className={s.badgeCat}>{b.category}</span>
          </motion.div>
        )
      })}
    </div>
  )
}

function RewardRow({ r }: { r: Reward }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    <div className={s.reward}>
      <div className={s.rowMain}>
        <div className={s.rowTitle}>{r.title}</div>
        <div className={s.rowMeta}>{error ?? r.blockedReason ?? r.description}</div>
      </div>
      {confirming ? (
        <div className={s.confirm}>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => void redeem()} disabled={busy}>
            Spend {formatNumber(r.cost)}
          </Button>
        </div>
      ) : (
        <Button size="sm" variant={r.canRedeem ? 'primary' : 'secondary'} disabled={!r.canRedeem} onClick={() => setConfirming(true)}>
          <Zap size={13} fill="currentColor" /> {formatNumber(r.cost)}
        </Button>
      )}
    </div>
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
              <Chip tone="ember">Mock data</Chip> Organiser views for the verification demo (open in another tab):
            </p>
            <ul className={s.orgLinks}>
              {events.data?.map((e) => (
                <li key={e.id}>
                  <Link to={`/organiser/event/${e.id}`} target="_blank">
                    {e.title}
                  </Link>
                </li>
              ))}
            </ul>
            <Button variant="secondary" size="sm" onClick={() => void api.resetDemo?.()}>
              <RotateCcw size={14} /> Reset demo data
            </Button>
          </>
        )}
        <Button variant="ghost" size="sm" onClick={() => void signOut()}>
          <LogOut size={14} /> Sign out
        </Button>
      </div>
    </Section>
  )
}
