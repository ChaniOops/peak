import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { House, Footprints, Ticket, Trophy, CircleUser } from 'lucide-react'
import styles from './AppShell.module.css'

// Frozen navigation — do not reorder or add items.
const TABS = [
  { to: '/', label: 'Home', icon: House },
  { to: '/track', label: 'Track', icon: Footprints },
  { to: '/play', label: 'Play', icon: Ticket },
  { to: '/compete', label: 'Compete', icon: Trophy },
  { to: '/you', label: 'You', icon: CircleUser },
] as const

export function AppShell({ overlay }: { overlay?: React.ReactNode }) {
  const location = useLocation()
  const section = '/' + (location.pathname.split('/')[1] ?? '')

  return (
    <div className={styles.frame}>
      <main className={styles.main}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={section}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      {overlay}
      <nav className={styles.tabbar} aria-label="Primary">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `${styles.tab} ${isActive ? styles.active : ''}`}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="tab-indicator"
                    className={styles.indicator}
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
                <Icon size={21} strokeWidth={isActive ? 2.3 : 1.8} />
                <span className={styles.tabLabel}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
