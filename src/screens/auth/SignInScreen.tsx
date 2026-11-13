import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { api, ApiError, OAUTH_LABEL, type OAuthProvider } from '../../api'
import { useAuth } from '../../app/auth'
import { Button, Field, IconButton } from '../../components/ui/ui'
import { BlurReplace } from '../../components/ui/BlurReplace'
import { PeakMark } from '../../components/brand/PeakMark'
import { PeakGlassField } from '../../components/visual/PeakGlassField'
import { POP_EASE, SOFT } from '../../lib/motion'
import s from './signin.module.css'

/**
 * FeralUI Screenery Login → Email flow over the Peak glass field.
 * Google/GitHub go through Supabase OAuth; email and the demo account use the
 * existing signIn(email, password) / signInDemo() calls.
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

/**
 * Error a provider sent back on the redirect (implicit flow: hash or query).
 * Read once per page load and cached, because reading also cleans the URL and
 * StrictMode runs state initialisers twice.
 */
let oauthReturn: string | null | undefined
function takeOAuthReturnError(): string | null {
  if (oauthReturn === undefined) oauthReturn = readOAuthReturnError()
  return oauthReturn
}

function readOAuthReturnError(): string | null {
  const read = (raw: string) => new URLSearchParams(raw.replace(/^[#?]/, ''))
  const hash = read(window.location.hash)
  const query = read(window.location.search)
  const desc = hash.get('error_description') ?? query.get('error_description')
  const code = hash.get('error') ?? query.get('error')
  if (!desc && !code) return null
  // clean the URL so a refresh doesn't replay the message
  window.history.replaceState(null, '', window.location.pathname)
  if (code === 'access_denied') return 'Sign-in was cancelled.'
  return (desc ?? 'Sign-in failed.').replace(/\+/g, ' ')
}

function Welcome({ onEmail }: { onEmail: () => void }) {
  const { signInDemo } = useAuth()
  const [busy, setBusy] = useState<OAuthProvider | 'demo' | null>(null)
  const [error, setError] = useState<string | null>(takeOAuthReturnError)

  async function oauth(provider: OAuthProvider) {
    setBusy(provider)
    setError(null)
    try {
      // on success the browser leaves for the provider; busy stays on
      await api.signInWithOAuth(provider)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `${OAUTH_LABEL[provider]} sign-in failed`)
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
        <motion.button
          type="button"
          className={`${s.btn} ${s.btnGoogle}`}
          onClick={() => void oauth('google')}
          disabled={busy !== null}
          aria-busy={busy === 'google' || undefined}
          {...enter(0.18)}
        >
          <GoogleIcon />
          <BlurReplace id={busy === 'google' ? 'busy' : 'idle'}>{busy === 'google' ? 'Opening Google…' : 'Continue with Google'}</BlurReplace>
        </motion.button>
        <motion.button
          type="button"
          className={`${s.btn} ${s.btnGithub}`}
          onClick={() => void oauth('github')}
          disabled={busy !== null}
          aria-busy={busy === 'github' || undefined}
          {...enter(0.22)}
        >
          <GitHubIcon />
          <BlurReplace id={busy === 'github' ? 'busy' : 'idle'}>{busy === 'github' ? 'Opening GitHub…' : 'Continue with GitHub'}</BlurReplace>
        </motion.button>
        <motion.button type="button" className={s.btnEmail} onClick={onEmail} disabled={busy !== null} {...enter(0.26)}>
          <Mail size={17} strokeWidth={2} />
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

/** Google "G" from the FeralUI LoginScreen source. */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" fill="#4285F4" />
      <path d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" fill="#34A853" />
      <path d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" fill="#FBBC05" />
      <path d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" fill="#EA4335" />
    </svg>
  )
}

/** GitHub Invertocat mark (lucide-react v1 ships no brand icons). */
function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.58l-.02-2.05c-3.34.73-4.04-1.6-4.04-1.6-.55-1.4-1.34-1.77-1.34-1.77-1.08-.74.09-.73.09-.73 1.2.09 1.83 1.24 1.83 1.24 1.07 1.83 2.8 1.3 3.49 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.8 5.63-5.48 5.92.42.36.81 1.1.81 2.22l-.01 3.29c0 .32.21.7.82.58A12 12 0 0 0 12 .3"
      />
    </svg>
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
