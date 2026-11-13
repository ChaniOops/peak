import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import { api, ApiError } from '../../api'
import { useAuth } from '../../app/auth'
import { Button, Field, IconButton, Notice } from '../../components/ui/ui'
import { PeakMark } from '../../components/brand/PeakMark'
import { EASE_OUT, rise, stagger } from '../../lib/motion'
import s from './signin.module.css'

export function SignInScreen() {
  const { signInDemo, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState<'password' | 'demo' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy('password')
    setError(null)
    try {
      await signIn(email.trim(), password)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign-in failed')
      setAttempt((n) => n + 1)
      setBusy(null)
    }
  }

  async function demo() {
    setBusy('demo')
    setError(null)
    try {
      await signInDemo()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Demo sign-in failed')
      setAttempt((n) => n + 1)
      setBusy(null)
    }
  }

  return (
    <div className={s.page}>
      <div className={s.glow} aria-hidden />
      <motion.header className={s.top} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, ease: EASE_OUT }}>
        <PeakMark size={28} />
        <span className={s.wordmark}>Peak</span>
      </motion.header>

      <motion.main className={s.panel} variants={stagger} initial="hidden" animate="show">
        <motion.div variants={rise} className={s.intro}>
          <h1 className={`display ${s.title}`}>Sign in to Peak</h1>
          <p className={s.tag}>Move on campus. Climb together.</p>
        </motion.div>

        <motion.form variants={rise} className={s.form} onSubmit={(e) => void submit(e)} noValidate>
          <Field
            label="Email"
            type="email"
            required
            placeholder="you@campus.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="next"
            error={Boolean(error)}
          />
          <Field
            label="Password"
            type={showPw ? 'text' : 'password'}
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            enterKeyHint="go"
            error={Boolean(error)}
            trailing={
              <IconButton
                type="button"
                variant="ghost"
                size={36}
                className={s.reveal}
                label={showPw ? 'Hide password' : 'Show password'}
                onClick={() => setShowPw((v) => !v)}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </IconButton>
            }
          />

          <AnimatePresence initial={false}>
            {error && (
              <motion.div
                key={attempt}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto', x: [0, -6, 5, -3, 0] }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.36, ease: EASE_OUT, x: { duration: 0.4 } }}
              >
                <Notice tone="danger">{error}</Notice>
              </motion.div>
            )}
          </AnimatePresence>

          <Button type="submit" size="lg" block loading={busy === 'password'} disabled={busy !== null || !email || !password}>
            Sign in {busy !== 'password' && <ArrowRight size={16} />}
          </Button>
        </motion.form>

        {api.demoAvailable && (
          <motion.div variants={rise} className={s.alt}>
            <div className={s.or}>
              <span>or</span>
            </div>
            <Button variant="secondary" size="lg" block loading={busy === 'demo'} disabled={busy !== null} onClick={() => void demo()}>
              Continue as demo student
            </Button>
          </motion.div>
        )}
      </motion.main>

      <motion.footer className={s.foot} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.6 }}>
        <span className="label">FitConnect · Campus movement</span>
      </motion.footer>
    </div>
  )
}
