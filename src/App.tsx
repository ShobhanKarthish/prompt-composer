import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { PromptComposer } from './components/composer/PromptComposer'
import type {
  ComposerSubmission,
  PromptComposerHandle,
} from './components/composer/PromptComposer'
import {
  ArrowUpIcon,
  GitHubIcon,
  MoonIcon,
  SunIcon,
} from './components/composer/icons'
import { composeReply } from './replies'

const SUGGESTIONS: { label: string; insert: string }[] = [
  { label: 'Summarize my meeting notes', insert: 'Summarize my meeting notes from today: ' },
  { label: 'Fix this error message', insert: 'Explain and fix this error: ' },
  { label: 'Try a /command', insert: '/' },
]

type Sent = {
  id: number
  text: string
  command: string | null
  files: number
  model: string | null
}

type Theme = 'light' | 'dark'

export default function App() {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.dataset.theme === 'light' ? 'light' : 'dark',
  )
  const [sent, setSent] = useState<Sent | null>(null)
  const [words, setWords] = useState<string[]>([])
  const [stopped, setStopped] = useState(false)
  const [revealed, setRevealed] = useState(0)
  const counter = useRef(0)
  const delay = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null)
  const composerRef = useRef<PromptComposerHandle>(null)

  const streaming = sent !== null && !stopped && revealed < words.length

  const toggleTheme = () => {
    const next: Theme = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    document.documentElement.dataset.theme = next
    localStorage.setItem('composer-theme', next)
  }

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
    const plan = composeReply(submission)
    const replyWords = plan.text.split(' ')
    setWords(replyWords)
    setSent({
      id: counter.current,
      text: submission.text,
      command: submission.command?.name ?? null,
      files: submission.attachments.length,
      model: submission.model.id !== 'balanced' ? submission.model.name : null,
    })
    setRevealed(0)
    setStopped(false)
    delay.current = setTimeout(() => {
      let count = 0
      ticker.current = setInterval(() => {
        count += 1
        if (count >= replyWords.length) clearTimers()
        setRevealed(count)
      }, plan.interval)
    }, plan.delay)
  }

  const handleStop = () => {
    clearTimers()
    setStopped(true)
  }

  return (
    <main className="page">
      <header className="chrome">
        <span className="wordmark">
          <span className="wordmark-logo">
            <ArrowUpIcon size={11} strokeWidth={2.5} />
          </span>
          Composer
        </span>
        <div className="chrome-actions">
          <a
            className="icon-btn"
            href="https://github.com/ShobhanKarthish/prompt-composer"
            target="_blank"
            rel="noreferrer"
            aria-label="View source on GitHub"
          >
            <GitHubIcon size={17} />
          </a>
          <button
            type="button"
            className="icon-btn"
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            onClick={toggleTheme}
          >
            <AnimatePresence initial={false}>
              <motion.span
                key={theme}
                className="icon-btn-swap"
                initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
                transition={{ type: 'spring', stiffness: 450, damping: 35 }}
              >
                {theme === 'light' ? <SunIcon size={16} /> : <MoonIcon size={16} />}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </header>

      <div className="stack">
        <header className="intro">
          <h1>A prompt input with feel.</h1>
          <p>
            Auto-grow, slash commands, attachments, voice, streaming states.
            React&thinsp;+&thinsp;Motion, no other dependencies.
          </p>
        </header>

        <div className="exchange">
          <AnimatePresence mode="popLayout">
            {sent === null ? (
              <motion.div
                key="suggestions"
                className="suggestions"
                initial={false}
                exit={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
                transition={{ duration: 0.2 }}
              >
                <span className="suggestions-label">Try one of these</span>
                <div className="suggestions-row">
                  {SUGGESTIONS.map((suggestion, index) => (
                    <motion.button
                      key={suggestion.label}
                      type="button"
                      className="suggestion"
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{
                        type: 'spring',
                        stiffness: 450,
                        damping: 38,
                        delay: 0.1 + index * 0.06,
                      }}
                      onClick={() => composerRef.current?.insert(suggestion.insert)}
                    >
                      {suggestion.label}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={sent.id}
                className="bubble"
                initial={{ opacity: 0, y: 10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 450, damping: 38 }}
              >
                {(sent.command || sent.files > 0 || sent.model) && (
                  <span className="bubble-meta">
                    {sent.command && <span>/{sent.command}</span>}
                    {sent.files > 0 && (
                      <span>
                        {sent.files} file{sent.files > 1 ? 's' : ''}
                      </span>
                    )}
                    {sent.model && <span>{sent.model}</span>}
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
              {words.slice(0, revealed).map((word, index) => (
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
          ref={composerRef}
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
