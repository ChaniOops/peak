import { useEffect, useRef, useState } from 'react'
import { CameraOff } from 'lucide-react'
import s from './QrScanner.module.css'

type CamState = 'starting' | 'scanning' | 'denied' | 'nocamera' | 'insecure' | 'error'

const MESSAGES: Partial<Record<CamState, string>> = {
  denied: 'Camera access was blocked. Allow it in browser settings, or enter the code below.',
  nocamera: 'No camera found on this device. Enter the code below.',
  insecure: 'Camera needs HTTPS. Open the app over https, or enter the code below.',
  error: 'Couldn’t start the camera. Enter the code below.',
}

/** Rear-camera QR scanner. Reports each decoded payload once. */
export function QrScanner({ onResult }: { onResult: (text: string) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const cb = useRef(onResult)
  const [state, setState] = useState<CamState>(() => (window.isSecureContext ? 'starting' : 'insecure'))

  useEffect(() => {
    cb.current = onResult
  })

  useEffect(() => {
    if (!window.isSecureContext) return
    let cancelled = false
    let scanner: import('qr-scanner').default | null = null
    let last = ''

    void (async () => {
      const { default: QrScannerLib } = await import('qr-scanner')
      if (cancelled || !video.current) return
      if (!(await QrScannerLib.hasCamera())) {
        setState('nocamera')
        return
      }
      scanner = new QrScannerLib(
        video.current,
        (r) => {
          if (r.data && r.data !== last) {
            last = r.data
            cb.current(r.data)
          }
        },
        {
          returnDetailedScanResult: true,
          preferredCamera: 'environment',
          maxScansPerSecond: 6,
          // scan the whole frame (default is the central 2/3), so a QR held close still decodes
          calculateScanRegion: (v) => {
            const w = v.videoWidth
            const h = v.videoHeight
            const scale = Math.min(1, 640 / Math.max(w, h))
            return { x: 0, y: 0, width: w, height: h, downScaledWidth: Math.round(w * scale), downScaledHeight: Math.round(h * scale) }
          },
        },
      )
      try {
        await scanner.start()
        if (!cancelled) setState('scanning')
      } catch (e) {
        const msg = String(e)
        setState(/NotAllowed|Permission|denied/i.test(msg) ? 'denied' : 'error')
      }
    })()

    return () => {
      cancelled = true
      scanner?.stop()
      scanner?.destroy()
    }
  }, [])

  const message = MESSAGES[state]

  return (
    <div className={s.frame}>
      <video ref={video} className={s.video} playsInline muted />
      {message ? (
        <div className={s.blocked}>
          <span className={s.blockedIcon}>
            <CameraOff size={20} />
          </span>
          <strong className={s.blockedTitle}>Camera needed</strong>
          <p>{message}</p>
        </div>
      ) : (
        <div className={s.finder} aria-hidden>
          <span className={`${s.corner} ${s.tl}`} />
          <span className={`${s.corner} ${s.tr}`} />
          <span className={`${s.corner} ${s.bl}`} />
          <span className={`${s.corner} ${s.br}`} />
          {state === 'scanning' && <span className={s.sweep} />}
        </div>
      )}
      <div className={s.caption}>
        <span className={s.captionPill}>{state === 'scanning' ? 'Point at the event QR' : state === 'starting' ? 'Starting camera…' : ''}</span>
      </div>
    </div>
  )
}
