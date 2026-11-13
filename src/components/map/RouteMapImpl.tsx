import { useEffect, useRef, useState } from 'react'
import { Map as MapLibreMap, LngLatBounds, setWorkerUrl, type GeoJSONSource, type LngLatLike } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import type { Feature } from 'geojson'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { GeoPoint } from '../../api/types'
import { CAMPUS, MAP_STYLE_URL } from '../../config'
import s from './RouteMap.module.css'

export interface RouteMapProps {
  route: GeoPoint[]
  /** Live mode: follow the head of the route. Otherwise fit the whole route. */
  follow?: boolean
  emptyLabel?: string
}

// MapLibre locates its worker relative to its own module URL, which Vite's
// dependency pre-bundling breaks. The worker file is self-contained, so point at it directly.
setWorkerUrl(workerUrl)

const ACCENT = '#eeeeee' // the route: white over the dark map

function toGeoJSON(route: GeoPoint[]) {
  const coords = route.map((p) => [p.lng, p.lat])
  const features: Feature[] = []
  if (coords.length > 1) {
    features.push({ type: 'Feature', properties: { kind: 'line' }, geometry: { type: 'LineString', coordinates: coords } })
  }
  if (coords.length > 0) {
    features.push({ type: 'Feature', properties: { kind: 'start' }, geometry: { type: 'Point', coordinates: coords[0] } })
    features.push({
      type: 'Feature',
      properties: { kind: 'head' },
      geometry: { type: 'Point', coordinates: coords[coords.length - 1] },
    })
  }
  return { type: 'FeatureCollection' as const, features }
}

export default function RouteMapImpl({ route, follow = false, emptyLabel = 'Waiting for GPS…' }: RouteMapProps) {
  const el = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!el.current) return
    const map = new MapLibreMap({
      container: el.current,
      style: MAP_STYLE_URL,
      center: [CAMPUS.center.lng, CAMPUS.center.lat],
      zoom: 15.5,
      attributionControl: { compact: true },
      interactive: !follow,
      pitchWithRotate: false,
      dragRotate: false,
    })
    mapRef.current = map

    map.on('load', () => {
      map.addSource('route', { type: 'geojson', data: toGeoJSON([]) })
      map.addLayer({
        id: 'route-casing',
        type: 'line',
        source: 'route',
        filter: ['==', ['get', 'kind'], 'line'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#080808', 'line-width': 9, 'line-opacity': 0.7 },
      })
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        filter: ['==', ['get', 'kind'], 'line'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ACCENT, 'line-width': 4.5 },
      })
      map.addLayer({
        id: 'route-start',
        type: 'circle',
        source: 'route',
        filter: ['==', ['get', 'kind'], 'start'],
        paint: {
          'circle-radius': 5,
          'circle-color': '#080808',
          'circle-stroke-color': '#f5f5f5',
          'circle-stroke-width': 2,
        },
      })
      map.addLayer({
        id: 'route-head-halo',
        type: 'circle',
        source: 'route',
        filter: ['==', ['get', 'kind'], 'head'],
        paint: { 'circle-radius': 16, 'circle-color': ACCENT, 'circle-opacity': 0.18 },
      })
      map.addLayer({
        id: 'route-head',
        type: 'circle',
        source: 'route',
        filter: ['==', ['get', 'kind'], 'head'],
        paint: {
          'circle-radius': 6.5,
          'circle-color': ACCENT,
          'circle-stroke-color': '#080808',
          'circle-stroke-width': 2.5,
        },
      })
      setReady(true)
    })
    map.on('error', (e) => {
      // Tile/style fetch failures (offline venue Wi-Fi) shouldn't break tracking.
      if (!map.isStyleLoaded()) setFailed(true)
      console.warn('[map]', e.error?.message)
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [follow])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    ;(map.getSource('route') as GeoJSONSource | undefined)?.setData(toGeoJSON(route))
    if (route.length === 0) return
    const head: LngLatLike = [route[route.length - 1].lng, route[route.length - 1].lat]
    if (follow) {
      map.easeTo({ center: head, duration: 900, zoom: Math.max(map.getZoom(), 16) })
    } else if (route.length > 1) {
      const b = new LngLatBounds()
      route.forEach((p) => b.extend([p.lng, p.lat]))
      map.fitBounds(b, { padding: 36, duration: 0, maxZoom: 17 })
    } else {
      map.jumpTo({ center: head })
    }
  }, [route, ready, follow])

  return (
    <div className={s.wrap}>
      <div ref={el} className={s.map} />
      {(route.length === 0 || failed) && (
        <div className={s.overlay}>
          <span className="label">{failed ? 'Map offline: route still recording' : emptyLabel}</span>
        </div>
      )}
    </div>
  )
}
