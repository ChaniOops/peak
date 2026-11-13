import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { House, Footprints, Ticket, Trophy, CircleUser } from 'lucide-react'
import { Toaster } from './Toaster'
import { LivePill } from './LivePill'
import { ConnectionBanner } from './ConnectionBanner'
import { PeakMark } from '../components/brand/PeakMark'
import { EASE_OUT, SPRING_LENS } from '../lib/motion'
import styles from './AppShell.module.css'

// Frozen navigation — do not reorder or add items.
const TABS = [
  { to: '/', label: 'Home', icon: House },
  { to: '/track', label: 'Track', icon: Footprints },
  { to: '/play', label: 'Play', icon: Ticket },
  { to: '/compete', label: 'Compete', icon: Trophy },
  { to: '/you', label: 'You', icon: CircleUser },
] as const

/**
 * One nav, two layouts: a bottom tab bar on phones/tablets and a left rail on
 * desktop, so the judge view reads as a product rather than a stretched phone.
 */
export function AppShell() {
  const location = useLocation()
  const section = '/' + (location.pathname.split('/')[1] ?? '')

  return (
    <div className={styles.frame}>
      <main className={styles.main}>
        {/* enter-only transition: instant tab switches, no exit wait */}
        <motion.div
          key={section}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.36, ease: EASE_OUT }}
        >
          <Outlet />
        </motion.div>
      </main>
      <Toaster />
      <ConnectionBanner />
      <LivePill />
      <nav className={`${styles.nav} pg-bar`} aria-label="Primary">
        <div className={styles.brand}>
          <span className={`pg-tile ${styles.brandTile}`}>
            <PeakMark size={22} framed={false} />
          </span>
          <span className={styles.wordmark}>Peak</span>
        </div>
        <div className={styles.tabs}>
          {TABS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `${styles.tab} ${isActive ? styles.active : ''}`}
            >
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="nav-active" className={styles.indicator} transition={SPRING_LENS} />}
                  <Icon size={20} strokeWidth={isActive ? 2.1 : 1.7} className={styles.icon} />
                  <span className={styles.tabLabel}>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
