import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Wifi, WifiOff } from 'lucide-react'
import { SPRING_POP } from '../lib/motion'
import s from './ConnectionBanner.module.css'

/** Display-only network status; data fetching and realtime are untouched. */
export function ConnectionBanner() {
  const [online, setOnline] = useState(() => navigator.onLine)
  const [justBack, setJustBack] = useState(false)

  useEffect(() => {
    let t = 0
    const up = () => {
      setOnline(true)
      setJustBack(true)
      window.clearTimeout(t)
      t = window.setTimeout(() => setJustBack(false), 2400)
    }
    const down = () => {
      setOnline(false)
      setJustBack(false)
    }
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  const show = !online || justBack
  return (
    <div className={s.wrap} aria-live="polite">
      <AnimatePresence>
        {show && (
          <motion.div
            key={online ? 'on' : 'off'}
            className={`${s.pill} ${online ? s.on : s.off}`}
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.18 } }}
            transition={SPRING_POP}
          >
            {online ? <Wifi size={14} /> : <WifiOff size={14} />}
            {online ? 'Back online' : 'Offline · showing last synced data'}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
