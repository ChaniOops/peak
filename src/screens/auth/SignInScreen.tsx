import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { api, ApiError } from '../../api'
import { useAuth } from '../../app/auth'
import { Button, Field, IconButton } from '../../components/ui/ui'
import { BlurReplace } from '../../components/ui/BlurReplace'
import { PeakMark } from '../../components/brand/PeakMark'
import { PeakGlassField } from '../../components/visual/PeakGlassField'
import { POP_EASE, SOFT } from '../../lib/motion'
import s from './signin.module.css'

/**
 * FeralUI Screenery Login → Email flow over the Peak glass field.
 * Email and the demo account use the existing signIn(email, password) /
 * signInDemo() calls.
 */
type Step = 'welcome' | 'email'

export function SignInScreen() {
  const [step, setStep] = useState<Step>('welcome')
  return (
    <div className={s.page}>
      <motion.div className={s.field} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.9, ease: SOFT }}>
        <PeakGlassField dim={step === 'email'} />
      </motion.div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          className={s.scene}
          exit={{ opacity: 0, y: -8, transition: { duration: 0.18, ease: SOFT } }}
        >
          {step === 'welcome' ? <Welcome onEmail={() => setStep('email')} /> : <EmailForm onBack={() => setStep('welcome')} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/* ── Login (Feral LoginScreen) ────────────────────────────────────────── */

function Welcome({ onEmail }: { onEmail: () => void }) {
  const { signInDemo } = useAuth()
  const [busy, setBusy] = useState<'demo' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function demo() {
    setBusy('demo')
    setError(null)
    try {
      await signInDemo()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Demo sign-in failed')
      setBusy(null)
    }
  }

  const enter = (delay: number) => ({
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.45, ease: SOFT },
  })

  return (
    <>
      <div className={s.copy}>
        <motion.div
          className={`${s.brand} glass`}
          initial={{ opacity: 0, scale: 0.6, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ opacity: { delay: 0.1, duration: 0.15 }, default: { delay: 0.1, duration: 0.6, ease: POP_EASE } }}
        >
          <PeakMark size={40} framed={false} />
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.6, ease: SOFT }}>
          Every step climbs.
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.55, ease: SOFT }}>
          Sign in to Peak. Move on campus, climb together.
        </motion.p>
      </div>

      <motion.div
        className={`${s.sheet} glass`}
        initial={{ opacity: 0, y: 26 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ opacity: { delay: 0.18, duration: 0.16 }, default: { delay: 0.18, duration: 0.6, ease: SOFT } }}
      >
        <motion.button type="button" className={s.btnEmail} onClick={onEmail} disabled={busy !== null} {...enter(0.18)}>
          <Mail size={18} strokeWidth={2} />
          Sign in with email
        </motion.button>
        <AnimatePresence initial={false}>
          {error && (
            <motion.p
              className={s.sheetError}
              role="alert"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: SOFT }}
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>

      <motion.div className={s.below} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.45 }}>
        {api.demoAvailable && (
          <button type="button" className={s.demo} onClick={() => void demo()} disabled={busy !== null}>
            <BlurReplace id={busy === 'demo' ? 'busy' : 'idle'}>{busy === 'demo' ? 'Signing in…' : 'Continue as demo student'}</BlurReplace>
          </button>
        )}
        <p className={s.terms}>FitConnect · Campus movement</p>
      </motion.div>
    </>
  )
}

/* ── Email (Feral EmailScreen) ────────────────────────────────────────── */

function EmailForm({ onBack }: { onBack: () => void }) {
  const { signIn, signInDemo } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState<'password' | 'demo' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const ready = email.includes('@') && password.length > 0

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!ready || busy) return
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

  const rise = (delay: number, y = 12) => ({
    initial: { opacity: 0, y },
    animate: { opacity: 1, y: 0 },
    transition: { opacity: { delay, duration: 0.14 }, default: { delay, duration: 0.5, ease: SOFT } },
  })

  return (
    <>
      <motion.div
        className={s.back}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.08, duration: 0.45, ease: SOFT }}
      >
        <IconButton label="Back" variant="secondary" size={38} className="glass" onClick={onBack} disabled={busy !== null}>
          <ChevronLeft size={18} />
        </IconButton>
      </motion.div>

      <form className={s.body} onSubmit={(e) => void submit(e)} noValidate>
        <motion.h1 {...rise(0.08)}>Welcome back.</motion.h1>
        <motion.div {...rise(0.08, 10)} className={error ? s.subError : s.sub} aria-live="polite">
          <motion.span key={attempt} animate={error ? { x: [0, -5, 4, -2, 0] } : undefined} transition={{ duration: 0.4 }} style={{ display: 'block' }}>
            <BlurReplace id={error ? `e${attempt}` : 'hello'} origin="left center" block>
              {error ?? 'Sign in with your campus account.'}
            </BlurReplace>
          </motion.span>
        </motion.div>

        <motion.div {...rise(0.15)} className={s.fieldGap}>
          <Field
            label="Email"
            hideLabel
            icon={<Mail size={18} strokeWidth={1.8} />}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="next"
            autoFocus
            error={Boolean(error)}
          />
        </motion.div>
        <motion.div {...rise(0.15)} className={s.fieldGapSm}>
          <Field
            label="Password"
            hideLabel
            icon={<Lock size={18} strokeWidth={1.8} />}
            type={showPw ? 'text' : 'password'}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            enterKeyHint="go"
            error={Boolean(error)}
            trailing={
              <IconButton
                type="button"
                variant="ghost"
                size={38}
                className={s.reveal}
                label={showPw ? 'Hide password' : 'Show password'}
                onClick={() => setShowPw((v) => !v)}
              >
                <BlurReplace id={showPw ? 'hide' : 'show'}>{showPw ? <EyeOff size={17} /> : <Eye size={17} />}</BlurReplace>
              </IconButton>
            }
          />
        </motion.div>

        <motion.div {...rise(0.22, 10)}>
          <Button type="submit" size="lg" block className={s.submit} loading={busy === 'password'} disabled={!ready || busy !== null}>
            {busy === 'password' ? 'Signing in…' : 'Sign in'}
          </Button>
        </motion.div>

        {api.demoAvailable && (
          <motion.p className={s.foot} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22, duration: 0.45 }}>
            Just looking?{' '}
            <button type="button" className={s.footLink} onClick={() => void demo()} disabled={busy !== null}>
              <b>{busy === 'demo' ? 'Signing in…' : 'Continue as demo student'}</b>
            </button>
          </motion.p>
        )}
      </form>
    </>
  )
}
