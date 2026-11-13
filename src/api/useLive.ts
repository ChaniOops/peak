import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '.'
import type { Topic } from './types'

/** Last good value per key, so switching tabs never flashes a spinner. */
const cache = new Map<string, unknown>()

export interface Live<T> {
  data: T | undefined
  error: Error | null
  loading: boolean
  reload: () => void
}

/**
 * Fetch once, then refetch whenever any of `topics` fires on the realtime bus.
 * `key` identifies the query for the cache; include any params in it.
 */
export function useLive<T>(key: string, fetcher: () => Promise<T>, topics: Topic[]): Live<T> {
  const [entry, setEntry] = useState<{ key: string; value: T } | null>(null)
  // When the key changes, fall back to the cached value for the new key until it loads.
  const data = entry?.key === key ? entry.value : (cache.get(key) as T | undefined)
  const [error, setError] = useState<Error | null>(null)
  const fetcherRef = useRef(fetcher)
  const seq = useRef(0)

  useEffect(() => {
    fetcherRef.current = fetcher
  })

  const load = useCallback(() => {
    const mine = ++seq.current
    fetcherRef
      .current()
      .then((v) => {
        if (mine !== seq.current) return
        cache.set(key, v)
        setEntry({ key, value: v })
        setError(null)
      })
      .catch((e: unknown) => {
        if (mine !== seq.current) return
        setError(e instanceof Error ? e : new Error(String(e)))
      })
  }, [key])

  const topicKey = topics.join(',')
  useEffect(() => {
    load()
    return api.subscribe(topicKey.split(',') as Topic[], load)
  }, [key, topicKey, load])

  return { data, error, loading: data === undefined && !error, reload: load }
}
