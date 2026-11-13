import type { Api } from './client'
import { MockApi } from './mock/mockApi'
import { SupabaseApi, supabaseConfigured } from './supabase/supabaseApi'

/**
 * Mock unless Supabase is configured AND mocks are explicitly turned off.
 * The demo must never be blocked on backend availability.
 */
const useMocks = import.meta.env.VITE_USE_MOCKS !== 'false' || !supabaseConfigured

export const api: Api = useMocks ? new MockApi() : new SupabaseApi()

export type { Api, OAuthProvider } from './client'
export { ApiError, OAUTH_LABEL } from './client'
