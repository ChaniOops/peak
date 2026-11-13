import { createStepDetector } from './stepDetector'

export type MotionStatus = 'off' | 'waiting' | 'ok' | 'denied' | 'unavailable'

type IOSDeviceMotionEvent = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

export const motionSupported = () => typeof window !== 'undefined' && 'DeviceMotionEvent' in window

/**
 * iOS 13+ requires an explicit permission prompt, and it must be triggered
 * from a user gesture. Call this FIRST in the Start button's click handler.
 */
export async function requestMotionPermission(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!motionSupported()) return 'unsupported'
  const DME = DeviceMotionEvent as IOSDeviceMotionEvent
  if (typeof DME.requestPermission !== 'function') return 'granted'
  try {
    return await DME.requestPermission()
  } catch {
    return 'denied'
  }
}

/**
 * Listen to DeviceMotion and report detected steps. Returns a stop function.
 * Reports 'unavailable' if no samples arrive (desktop browsers expose the API
 * but never fire it).
 */
export function watchSteps(onSteps: (n: number) => void, onStatus: (s: MotionStatus) => void): () => void {
  if (!motionSupported() || !window.isSecureContext) {
    onStatus('unavailable')
    return () => {}
  }
  const detector = createStepDetector()
  let gotSample = false
  onStatus('waiting')

  const handler = (e: DeviceMotionEvent) => {
    const a = e.accelerationIncludingGravity
    if (!a || a.x === null || a.y === null || a.z === null) return
    if (!gotSample) {
      gotSample = true
      onStatus('ok')
    }
    const n = detector.push(a.x, a.y, a.z, e.timeStamp || performance.now())
    if (n > 0) onSteps(n)
  }
  window.addEventListener('devicemotion', handler)
  const probe = window.setTimeout(() => {
    if (!gotSample) onStatus('unavailable')
  }, 3000)

  return () => {
    window.clearTimeout(probe)
    window.removeEventListener('devicemotion', handler)
  }
}
