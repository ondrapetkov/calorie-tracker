import { useCallback, useEffect, useRef, useState } from 'react'
import { decodeBarcode } from './decoder'

interface Props {
  onDetected: (barcode: string) => void
}

interface Stats {
  avgDecodeMs: number
  framesPerSec: number
}

const MAX_DECODE_WIDTH = 960

export function Scanner({ onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const runningRef = useRef(false)
  const onDetectedRef = useRef(onDetected)
  onDetectedRef.current = onDetected
  const [active, setActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)

  const stop = useCallback(() => {
    runningRef.current = false
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setActive(false)
  }, [])

  const loop = useCallback(async () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    let frames = 0
    let decodeTotal = 0
    let windowStart = performance.now()

    while (runningRef.current) {
      if (video.readyState >= 2 && video.videoWidth > 0) {
        const scale = Math.min(1, MAX_DECODE_WIDTH / video.videoWidth)
        canvas.width = Math.round(video.videoWidth * scale)
        canvas.height = Math.round(video.videoHeight * scale)
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height)

        const t0 = performance.now()
        const code = await decodeBarcode(image)
        decodeTotal += performance.now() - t0
        frames++

        if (code && runningRef.current) {
          stop()
          onDetectedRef.current(code)
          return
        }
        const now = performance.now()
        if (now - windowStart > 1000) {
          setStats({
            avgDecodeMs: Math.round(decodeTotal / frames),
            framesPerSec: Math.round((frames * 1000) / (now - windowStart)),
          })
          frames = 0
          decodeTotal = 0
          windowStart = now
        }
      }
      await new Promise((r) => setTimeout(r, 30))
    }
  }, [stop])

  const start = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current!
      video.srcObject = stream
      await video.play()
      runningRef.current = true
      setActive(true)
      void loop()
    } catch (e) {
      stop()
      setError(e instanceof Error ? `${e.name}: ${e.message}` : String(e))
    }
  }, [loop, stop])

  useEffect(() => {
    const onHide = () => document.hidden && stop()
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      stop()
    }
  }, [stop])

  return (
    <div>
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-black">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        {active ? (
          <div className="absolute inset-x-[10%] inset-y-[35%] rounded-lg border-2 border-accent" />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-sm text-muted">Camera off</div>
        )}
      </div>
      <canvas ref={canvasRef} hidden />
      <div className="mt-3">
        {active ? (
          <button
            type="button"
            onClick={stop}
            className="w-full rounded-lg border border-line-strong px-4 py-2.5 font-medium"
          >
            Stop camera
          </button>
        ) : (
          <button
            type="button"
            onClick={start}
            className="w-full rounded-lg bg-accent px-4 py-2.5 font-medium text-on-accent active:bg-accent-dim"
          >
            Start camera
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-danger">Camera error: {error}</p>}
      {stats && active && (
        <p className="mt-2 text-xs text-muted">
          {stats.avgDecodeMs} ms/decode · {stats.framesPerSec} fps
        </p>
      )}
    </div>
  )
}
