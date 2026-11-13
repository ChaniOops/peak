/**
 * Step detection from accelerometer magnitude. Pure, no DOM, so it can be
 * reasoned about and replayed.
 *
 * Pipeline per sample:
 *   |a| (incl. gravity) → subtract slow EMA (gravity estimate)
 *     → fast EMA (smooth) → hysteresis peak detector with adaptive threshold
 *     → min interval gate → "confirmed walking" gate
 *
 * The confirmation gate holds the first steps of a bout until a second step
 * arrives within MAX_GAP_MS, so a single bump or a phone set on a table
 * doesn't count.
 */

export interface StepDetectorOptions {
  /** Minimum time between steps. ~3.3 steps/s is a fast run. */
  minIntervalMs?: number
  /** Gap after which a new bout must re-confirm. */
  maxGapMs?: number
  /** Floor for the peak threshold, m/s². */
  minThreshold?: number
  /** Steps needed before a bout starts counting. */
  confirmSteps?: number
}

export interface StepDetector {
  /** Feed one sample. Returns number of steps newly counted (0, 1, or the confirmed backlog). */
  push(x: number, y: number, z: number, tMs: number): number
  reset(): void
}

export function createStepDetector(opts: StepDetectorOptions = {}): StepDetector {
  const minIntervalMs = opts.minIntervalMs ?? 280
  const maxGapMs = opts.maxGapMs ?? 2000
  const minThreshold = opts.minThreshold ?? 1.1
  const confirmSteps = opts.confirmSteps ?? 3

  let gravity: number | null = null
  let smooth = 0
  let lastT: number | null = null
  let armed = true
  let peak = 0
  let peakAvg = 2.6
  let lastStepT = -Infinity
  let pending = 0 // unconfirmed steps in current bout
  let confirmed = false

  function reset() {
    gravity = null
    smooth = 0
    lastT = null
    armed = true
    peak = 0
    peakAvg = 2.6
    lastStepT = -Infinity
    pending = 0
    confirmed = false
  }

  function push(x: number, y: number, z: number, t: number): number {
    const mag = Math.sqrt(x * x + y * y + z * z)
    const dt = lastT === null ? 16 : Math.min(200, Math.max(1, t - lastT))
    lastT = t

    // time-constant based EMAs so behaviour is independent of sample rate
    const aSlow = 1 - Math.exp(-dt / 1500)
    const aFast = 1 - Math.exp(-dt / 45)
    gravity = gravity === null ? mag : gravity + aSlow * (mag - gravity)
    smooth += aFast * (mag - gravity - smooth)

    const threshold = Math.min(6, Math.max(minThreshold, peakAvg * 0.45))
    let counted = 0

    if (armed && smooth > threshold) {
      armed = false
      peak = smooth
      if (t - lastStepT >= minIntervalMs) {
        if (t - lastStepT > maxGapMs) {
          // new bout
          confirmed = false
          pending = 0
        }
        lastStepT = t
        if (confirmed) {
          counted = 1
        } else {
          pending++
          if (pending >= confirmSteps) {
            confirmed = true
            counted = pending
            pending = 0
          }
        }
      }
    } else if (!armed) {
      if (smooth > peak) peak = smooth
      if (smooth < threshold * 0.3) {
        armed = true
        peakAvg = peakAvg * 0.8 + Math.min(peak, 12) * 0.2
      }
    }
    return counted
  }

  return { push, reset }
}
