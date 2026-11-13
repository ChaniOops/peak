import { lazy, Suspense } from 'react'
import type { RouteMapProps } from './RouteMapImpl'
import s from './RouteMap.module.css'

// MapLibre is large; load it only when a map is actually shown.
const Impl = lazy(() => import('./RouteMapImpl'))

export function RouteMap(props: RouteMapProps) {
  return (
    <Suspense fallback={<div className={s.wrap} />}>
      <Impl {...props} />
    </Suspense>
  )
}
