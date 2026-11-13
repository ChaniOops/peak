import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Activity as RunIcon, Award, Bike, Footprints, Gift, Lock, LogOut, RotateCcw, Ticket, Zap, ExternalLink, X } from 'lucide-react'
import { api, ApiError } from '../../api'
import { useLive } from '../../api/useLive'
import type { Badge, Reward, TrackedActivityType } from '../../api/types'
import { Button, Chip, EmptyState, ErrorNote, IconButton, List, ListRow, Section, Skeleton } from '../../components/ui/ui'
import { BlurReplace } from '../../components/ui/BlurReplace'
import { SuccessCheck } from '../../components/ui/SuccessCheck'
import { RollingNumber } from '../../components/ui/RollingNumber'
import { Avatar } from '../../components/ui/Avatar'
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
              <RollingNumber value={me.data.movePoints} />
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

      <Section title="Rewards" meta={me.data && <span className="label">{formatNumber(me.data.movePoints)} pts to spend</span>}>
        {rewards.data ? (
          rewards.data.length ? (
            <List>
              {rewards.data.map((r) => (
                <RewardRow key={r.id} r={r} balance={me.data?.movePoints ?? 0} />
              ))}
            </List>
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
              <AnimatePresence initial={false}>
                {redemptions.data.map((r) => (
                  <motion.li
                    key={r.id}
                    className={s.redeemedRow}
                    layout="position"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, ease: EASE_OUT }}
                  >
                    <span className={s.rowIcon}>
                      <Ticket size={16} />
                    </span>
                    <div className={s.redeemedMain}>
                      <div className={s.redeemedTitle}>{r.rewardTitle}</div>
                      <div className={s.redeemedMeta}>
                        {r.status === 'fulfilled' ? 'Fulfilled' : 'Requested'} · {timeAgo(r.createdAt)}
                      </div>
                    </div>
                    {r.code && <code className={s.code}>{r.code}</code>}
                  </motion.li>
                ))}
              </AnimatePresence>
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

/** Affordability ring around the reward icon: balance against cost. */
function CostRing({ progress, ready }: { progress: number; ready: boolean }) {
  const r = 19
  const c = 2 * Math.PI * r
  return (
    <svg className={s.ring} viewBox="0 0 44 44" aria-hidden>
      <circle cx="22" cy="22" r={r} className={s.ringTrack} />
      <circle
        cx="22"
        cy="22"
        r={r}
        className={`${s.ringFill} ${ready ? s.ringReady : ''}`}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.min(1, progress))}
      />
    </svg>
  )
}

function RewardRow({ r, balance }: { r: Reward; balance: number }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justRedeemed, setJustRedeemed] = useState(false)
  const short = Math.max(0, r.cost - balance)

  useEffect(() => {
    if (!justRedeemed) return
    const t = window.setTimeout(() => setJustRedeemed(false), 2600)
    return () => window.clearTimeout(t)
  }, [justRedeemed])
  useEffect(() => {
    if (!confirming) return
    const t = window.setTimeout(() => setConfirming(false), 4000)
    return () => window.clearTimeout(t)
  }, [confirming])

  async function redeem() {
    setBusy(true)
    setError(null)
    try {
      await api.redeemReward(r.id)
      setConfirming(false)
      setJustRedeemed(true)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not redeem')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className={`${s.reward} ${r.canRedeem ? s.rewardReady : ''}`}>
      <span className={s.rewardIcon}>
        <CostRing progress={balance / Math.max(1, r.cost)} ready={r.canRedeem} />
        <Gift size={16} />
      </span>
      <div className={s.rewardText}>
        <div className={s.rewardTitle}>{r.title}</div>
        <div className={`${s.rewardDesc} ${error ? s.rewardError : ''}`}>
          <BlurReplace id={error ? 'err' : 'desc'} origin="left center">
            {error ?? r.blockedReason ?? r.description}
          </BlurReplace>
        </div>
      </div>
      <div className={s.rewardSide}>
        {justRedeemed ? (
          <span className={s.redeemed}>
            <SuccessCheck size={26} />
            Redeemed
          </span>
        ) : r.canRedeem ? (
          <div className={s.redeemActions}>
            <AnimatePresence initial={false}>
              {confirming && (
                <motion.span initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={SPRING_POP}>
                  <IconButton label="Cancel" variant="ghost" size={30} onClick={() => setConfirming(false)} disabled={busy}>
                    <X size={14} />
                  </IconButton>
                </motion.span>
              )}
            </AnimatePresence>
            <Button
              size="sm"
              variant="primary"
              loading={busy}
              onClick={() => (confirming ? void redeem() : setConfirming(true))}
            >
              <BlurReplace id={confirming ? 'c' : 'r'}>
                {confirming ? (
                  <>Confirm · {formatNumber(r.cost)}</>
                ) : (
                  <span className={s.costInline}>
                    <Zap size={11} fill="currentColor" /> {formatNumber(r.cost)}
                  </span>
                )}
              </BlurReplace>
            </Button>
          </div>
        ) : (
          <div className={s.locked}>
            <span className={`num ${s.lockedCost}`}>
              <Zap size={11} fill="currentColor" /> {formatNumber(r.cost)}
            </span>
            <span className={s.lockedGap}>{short > 0 ? `${formatNumber(short)} to go` : 'Unavailable'}</span>
          </div>
        )}
      </div>
    </li>
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
