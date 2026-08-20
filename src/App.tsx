import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { PromptComposer } from './components/composer/PromptComposer'
import type { ComposerSubmission } from './components/composer/PromptComposer'

const REPLY =
  'Nice — although the composer is the real product here. Try pasting a screenshot, dropping a file onto the input, or typing / to pick a command.'

const WORDS = REPLY.split(' ')

type Sent = {
  id: number
  text: string
  command: string | null
  files: number
}

export default function App() {
  const [sent, setSent] = useState<Sent | null>(null)
  const [stopped, setStopped] = useState(false)
  const [revealed, setRevealed] = useState(0)
  const counter = useRef(0)
  const delay = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null)

  const streaming = sent !== null && !stopped && revealed < WORDS.length

  const clearTimers = () => {
    if (delay.current) clearTimeout(delay.current)
    if (ticker.current) clearInterval(ticker.current)
    delay.current = null
    ticker.current = null
  }

  useEffect(() => clearTimers, [])

  const handleSubmit = (submission: ComposerSubmission) => {
    clearTimers()
    counter.current += 1
    setSent({
      id: counter.current,
      text: submission.text,
      command: submission.command?.name ?? null,
      files: submission.attachments.length,
    })
    setRevealed(0)
    setStopped(false)
    delay.current = setTimeout(() => {
      let count = 0
      ticker.current = setInterval(() => {
        count += 1
        if (count >= WORDS.length) clearTimers()
        setRevealed(count)
      }, 55)
    }, 700)
  }

  const handleStop = () => {
    clearTimers()
    setStopped(true)
  }

  return (
    <main className="page">
      <div className="stack">
        <header className="intro">
          <h1>Composer</h1>
          <p>
            A prompt input with feel — auto-grow, attachments, slash commands,
            streaming states. React&thinsp;+&thinsp;Motion.
          </p>
        </header>

        <div className="exchange">
          <AnimatePresence mode="popLayout">
            {sent && (
              <motion.div
                key={sent.id}
                className="bubble"
                initial={{ opacity: 0, y: 10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 450, damping: 38 }}
              >
                {(sent.command || sent.files > 0) && (
                  <span className="bubble-meta">
                    {sent.command && <span>/{sent.command}</span>}
                    {sent.files > 0 && (
                      <span>
                        {sent.files} file{sent.files > 1 ? 's' : ''}
                      </span>
                    )}
                  </span>
                )}
                {sent.text || '…'}
              </motion.div>
            )}
          </AnimatePresence>

          {sent && (
            <div className="reply">
              {streaming && revealed === 0 && (
                <span className="dots" aria-label="Thinking">
                  <span />
                  <span />
                  <span />
                </span>
              )}
              {WORDS.slice(0, revealed).map((word, index) => (
                <motion.span
                  key={`${sent.id}-${index}`}
                  className="word"
                  initial={{ opacity: 0, y: 3, filter: 'blur(3px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                >
                  {word}{' '}
                </motion.span>
              ))}
            </div>
          )}
        </div>

        <PromptComposer
          streaming={streaming}
          onSubmit={handleSubmit}
          onStop={handleStop}
        />

        <footer className="hints">
          <span>
            <kbd>↵</kbd> send
          </span>
          <span>
            <kbd>⇧↵</kbd> newline
          </span>
          <span>
            <kbd>/</kbd> commands
          </span>
          <span>
            <kbd>⌫</kbd> clear chips
          </span>
          <span>paste or drop files</span>
        </footer>
      </div>
    </main>
  )
}
