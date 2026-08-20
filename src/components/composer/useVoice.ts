import { useCallback, useEffect, useRef, useState } from 'react'

type SpeechResultEvent = {
  resultIndex: number
  results: {
    length: number
    [index: number]: { isFinal: boolean; 0: { transcript: string } }
  }
}

type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechResultEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
}

/**
 * Microphone capture for the composer: live level data for the waveform
 * (WebAudio analyser, written straight to DOM transforms — no re-renders)
 * plus speech-to-text via the SpeechRecognition API where available.
 */
export function useVoice() {
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  const barsEl = useRef<HTMLDivElement | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const audioCtx = useRef<AudioContext | null>(null)
  const raf = useRef(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const recognition = useRef<SpeechRecognitionLike | null>(null)
  const finalText = useRef('')
  const interimText = useRef('')

  const supported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window !== 'undefined' &&
    !!(window.SpeechRecognition ?? window.webkitSpeechRecognition)

  const teardown = useCallback(() => {
    cancelAnimationFrame(raf.current)
    if (timer.current) clearInterval(timer.current)
    timer.current = null
    if (recognition.current) {
      recognition.current.onresult = null
      recognition.current.onend = null
      try {
        recognition.current.stop()
      } catch {
        // already stopped
      }
      recognition.current = null
    }
    stream.current?.getTracks().forEach((track) => track.stop())
    stream.current = null
    audioCtx.current?.close().catch(() => {})
    audioCtx.current = null
    setRecording(false)
  }, [])

  useEffect(() => teardown, [teardown])

  const attachBars = useCallback((el: HTMLDivElement | null) => {
    barsEl.current = el
  }, [])

  const start = useCallback(async () => {
    if (recording) return
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.current = media

      const ctx = new AudioContext()
      audioCtx.current = ctx
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.75
      ctx.createMediaStreamSource(media).connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)

      const loop = () => {
        analyser.getByteFrequencyData(data)
        const bars = barsEl.current?.children
        if (bars) {
          for (let i = 0; i < bars.length; i++) {
            // voice lives in the lower bins — spread bars across them
            const bin = Math.floor((i / bars.length) * data.length * 0.6)
            const level = Math.max(0.12, data[bin] / 255)
            const el = bars[i] as HTMLElement
            el.style.transform = `scaleY(${level.toFixed(3)})`
          }
        }
        raf.current = requestAnimationFrame(loop)
      }
      raf.current = requestAnimationFrame(loop)

      const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition
      if (Recognition) {
        const rec = new Recognition()
        rec.continuous = true
        rec.interimResults = true
        rec.onresult = (event) => {
          let interim = ''
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i]
            if (result.isFinal) finalText.current += result[0].transcript
            else interim += result[0].transcript
          }
          interimText.current = interim
        }
        try {
          rec.start()
          recognition.current = rec
        } catch {
          // recognition unavailable — waveform still works
        }
      }

      finalText.current = ''
      interimText.current = ''
      setElapsed(0)
      timer.current = setInterval(() => setElapsed((s) => s + 1), 1000)
      setRecording(true)
    } catch {
      teardown()
    }
  }, [recording, teardown])

  const cancel = useCallback(() => {
    teardown()
  }, [teardown])

  const confirm = useCallback(() => {
    const transcript = `${finalText.current} ${interimText.current}`
      .replace(/\s+/g, ' ')
      .trim()
    teardown()
    return transcript
  }, [teardown])

  return { supported, recording, elapsed, start, cancel, confirm, attachBars }
}
