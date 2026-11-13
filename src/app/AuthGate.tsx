import { useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { api } from '../api'
import type { UserProfile } from '../api/types'
import { AuthContext, type AuthState } from './auth'
import { SignInScreen } from '../screens/auth/SignInScreen'

/**
 * Demo-first auth. In mock mode the seeded student is signed in by default;
 * real Supabase auth plugs in behind the same api calls. Auth must never
 * block the core demo, so a failed session check falls through to sign-in
 * where "Continue as demo student" is always available in mock mode.
 */
export function AuthGate() {
  const [status, setStatus] = useState<AuthState['status']>('loading')
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
      async signInWithEmail(email) {
        await api.signInWithEmail(email)
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
      {status === 'loading' ? <div style={{ minHeight: '100vh' }} /> : status === 'signed-in' ? <Outlet /> : <SignInScreen />}
    </AuthContext.Provider>
  )
}
