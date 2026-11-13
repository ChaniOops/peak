/**
 * Known web limitation: browsers pause DeviceMotion and Geolocation when the
 * screen locks or the tab is backgrounded. We hold a Screen Wake Lock during a
 * session and tell the user to keep the screen on. No native/background
 * workaround is attempted.
 */
let sentinel: WakeLockSentinel | null = null
let wanted = false

export const wakeLockSupported = () => typeof navigator !== 'undefined' && 'wakeLock' in navigator

async function acquire() {
  if (!wakeLockSupported() || document.visibilityState !== 'visible') return
  try {
    sentinel = await navigator.wakeLock.request('screen')
    sentinel.addEventListener('release', () => {
      sentinel = null
    })
  } catch {
    sentinel = null
  }
}

function onVisibility() {
  if (wanted && document.visibilityState === 'visible' && !sentinel) void acquire()
}

export async function holdWakeLock() {
  wanted = true
  document.addEventListener('visibilitychange', onVisibility)
  await acquire()
}

export async function releaseWakeLock() {
  wanted = false
  document.removeEventListener('visibilitychange', onVisibility)
  await sentinel?.release().catch(() => {})
  sentinel = null
}
