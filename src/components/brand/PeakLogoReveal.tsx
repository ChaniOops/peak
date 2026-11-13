import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { PeakMark } from './PeakMark'
import { PEAK_LOOK, createRenderer, frameAt, peakLogoField, revealLength } from './liquidGlass/engine'
import s from './peakLogoReveal.module.css'

/**
 * Peak's signature motion: the Liquid Glass Logo Reveal (zanwei/glass-icon-reveal,
 * MIT) playing the Peak mark — a droplet lands, spreads into a glass tile that
 * refracts the mark at its rim with spectral dispersion, then lets go.
 *
 * One WebGL2 context, a small square canvas (DPR ≤ 2), one pass, then it is
 * disposed. Reduced motion, no WebGL2 or any failure → the static mark.
 */
export function PeakLogoReveal({ size = 112, onDone }: { size?: number; onDone?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduce = !!useReducedMotion()
  const [fallback, setFallback] = useState(reduce)
  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  }, [onDone])

  useEffect(() => {
    if (reduce) {
      doneRef.current?.()
      return
    }
    const canvas = canvasRef.current
    if (!canvas) return
    let raf = 0
    let alive = true
    const finish = () => {
      if (!alive) return
      alive = false
      doneRef.current?.()
    }
    const bail = () => {
      setFallback(true)
      finish()
    }

    const r = (() => {
      try {
        return createRenderer(canvas)
      } catch {
        return null
      }
    })()
    if (!r) {
      bail()
      return
    }
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const side = Math.round(size * 1.9 * dpr)
    canvas.width = side
    canvas.height = side
    const tilePx = size * dpr
    const length = revealLength(PEAK_LOOK)

    peakLogoField()
      .then((logo) => {
        if (!alive) return
        r.setLogo(logo)
        let t0 = 0
        const tick = (now: number) => {
          if (!alive) return
          if (!t0) t0 = now
          // a hidden tab would freeze mid-reveal: jump to the end instead
          const T = document.hidden ? length : (now - t0) / 1000
          r.render(frameAt(Math.min(T, length), PEAK_LOOK), side, side, tilePx)
          if (T >= length) finish()
          else raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      })
      .catch(bail)

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      // release the GL context only once the canvas has really left the page
      // (StrictMode re-runs effects on the same canvas: a lost context can't compile)
      window.setTimeout(() => {
        if (!canvas.isConnected) r.dispose()
      }, 0)
    }
  }, [reduce, size])

  return (
    <div className={s.root} style={{ width: size * 1.9, height: size * 1.9 }} aria-hidden="true">
      {fallback ? (
        <span className={s.still}>
          <PeakMark size={size * 0.62} framed={false} />
        </span>
      ) : (
        <canvas ref={canvasRef} className={s.canvas} />
      )}
    </div>
  )
}
