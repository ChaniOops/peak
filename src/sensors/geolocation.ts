import type { GeoPoint } from '../api/types'

export type GpsStatus = 'off' | 'acquiring' | 'ok' | 'weak' | 'denied' | 'unavailable'

export const geolocationSupported = () => typeof navigator !== 'undefined' && 'geolocation' in navigator

/**
 * Continuous high-accuracy sampling. Returns a stop function.
 * Note: browsers suspend this when the screen locks — see wakeLock.ts.
 */
export function watchGeolocation(
  onFix: (p: GeoPoint) => void,
  onStatus: (s: GpsStatus, accuracyM?: number) => void,
): () => void {
  if (!geolocationSupported() || !window.isSecureContext) {
    onStatus('unavailable')
    return () => {}
  }
  onStatus('acquiring')
  const id = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords
      onStatus(accuracy <= 25 ? 'ok' : 'weak', accuracy)
      onFix({ lat: latitude, lng: longitude, t: pos.timestamp || Date.now(), accuracy })
    },
    (err) => {
      if (err.code === err.PERMISSION_DENIED) onStatus('denied')
      else if (err.code === err.POSITION_UNAVAILABLE) onStatus('unavailable')
      // TIMEOUT: keep waiting, the watch continues
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
  )
  return () => navigator.geolocation.clearWatch(id)
}
