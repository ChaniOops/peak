import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Outlet } from 'react-router-dom'
import { api } from '../api'
import type { UserProfile } from '../api/types'
import { AuthContext, type AuthState } from './auth'
import { SignInScreen } from '../screens/auth/SignInScreen'
import { BootScreen } from './BootScreen'

/**
 * Demo-first auth. In mock mode the seeded student is signed in by default;
 * real Supabase auth plugs in behind the same api calls. Auth must never
 * block the core demo, so a failed session check falls through to sign-in
 * where "Continue as demo student" is always available in mock mode.
 */
const INTRO_KEY = 'peak:intro-played'
const introSeen = () => {
  try {
    return sessionStorage.getItem(INTRO_KEY) === '1' || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return true
  }
}

export function AuthGate() {
  const [status, setStatus] = useState<AuthState['status']>('loading')
  // the signature reveal plays once per browser session; later loads go straight in
  const [introDone, setIntroDone] = useState(introSeen)
  const [playIntro] = useState(() => !introDone)
  const endIntro = useCallback(() => {
    try {
      sessionStorage.setItem(INTRO_KEY, '1')
    } catch {
      /* private mode: just don't remember */
    }
    setIntroDone(true)
  }, [])
  const [user, setUser] = useState<UserProfile | null>(null)

  const refresh = useCallback(() => {
    api
      .getSession()
      .then((u) => {
        setUser(u)
        setStatus(u ? 'signed-in' : 'signed-out')
      })
      .catch(() => setStatus('signed-out'))
  }, [])

  useEffect(() => {
    refresh()
    return api.subscribe(['profile'], refresh)
  }, [refresh])

  const value = useMemo<AuthState>(
    () => ({
      status,
      user,
      async signInDemo() {
        const u = await api.signInDemo()
        setUser(u)
        setStatus('signed-in')
      },
      async signIn(email, password) {
        const u = await api.signIn(email, password)
        setUser(u)
        setStatus('signed-in')
      },
      async signOut() {
        await api.signOut()
        setUser(null)
        setStatus('signed-out')
      },
    }),
    [status, user],
  )

  return (
    <AuthContext.Provider value={value}>
      {/* the app mounts once the reveal is done, so its WebGL never competes with it */}
      {status !== 'loading' && introDone && (status === 'signed-in' ? <Outlet /> : <SignInScreen />)}
      <AnimatePresence>
        {(status === 'loading' || !introDone) && <BootScreen key="boot" play={playIntro} onDone={endIntro} />}
      </AnimatePresence>
    </AuthContext.Provider>
  )
}
