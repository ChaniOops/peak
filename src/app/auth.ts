import { createContext, useContext } from 'react'
import type { UserProfile } from '../api/types'

export interface AuthState {
  status: 'loading' | 'signed-in' | 'signed-out'
  user: UserProfile | null
  signInDemo(): Promise<void>
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
