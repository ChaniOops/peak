import { useState } from 'react'
import { motion } from 'framer-motion'
import { api, ApiError } from '../../api'
import { useAuth } from '../../app/auth'
import { Button } from '../../components/ui/ui'
import { TopoLines } from '../../components/topo/TopoLines'
import s from './signin.module.css'

export function SignInScreen() {
  const { signInDemo, signInWithEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendLink(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signInWithEmail(email.trim())
      setSent(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send the link')
    } finally {
      setBusy(false)
    }
  }

  async function demo() {
    setBusy(true)
    setError(null)
    try {
      await signInDemo()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Demo sign-in failed')
      setBusy(false)
    }
  }

  return (
    <div className={s.page}>
      <TopoLines className={s.topo} seed={21} rings={14} cx={200} cy={150} />
      <motion.div
        className={s.brand}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="label">FitConnect</div>
        <h1 className={`display ${s.word}`}>Peak</h1>
        <p className={s.tag}>Move on campus. Climb together.</p>
      </motion.div>

      <div className={s.actions}>
        {api.mode === 'mock' && (
          <Button size="lg" block onClick={() => void demo()} disabled={busy}>
            Continue as demo student
          </Button>
        )}
        {sent ? (
          <p className={s.sent}>Check {email} for your sign-in link.</p>
        ) : (
          <form className={s.form} onSubmit={(e) => void sendLink(e)}>
            <input
              type="email"
              required
              className={s.input}
              placeholder="you@campus.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <Button type="submit" variant="secondary" disabled={busy || !email}>
              Email link
            </Button>
          </form>
        )}
        {error && <p className={s.error}>{error}</p>}
      </div>
    </div>
  )
}
