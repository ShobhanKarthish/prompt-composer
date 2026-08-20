import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import type { KeyboardEvent, ReactNode, Ref } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { Transition } from 'motion/react'
import { SlashMenu } from './SlashMenu'
import { ModelMenu } from './ModelMenu'
import { defaultCommands } from './commands'
import { defaultModels } from './models'
import type { ModelOption } from './models'
import { useVoice } from './useVoice'
import {
  ArrowUpIcon,
  CheckIcon,
  FileTextIcon,
  ImageIcon,
  MicIcon,
  PlusIcon,
  SlashIcon,
  StopIcon,
  XIcon,
} from './icons'
import './composer.css'

export type Attachment = {
  id: string
  file: File
  /** Object URL for image previews, null for other files */
  url: string | null
  kind: 'image' | 'file'
}

export type SlashCommand = {
  id: string
  name: string
  description: string
  /** Placeholder shown once the command is active */
  hint: string
  icon: ReactNode
}

export type ComposerSubmission = {
  text: string
  command: SlashCommand | null
  attachments: Attachment[]
  model: ModelOption
}

export type PromptComposerHandle = {
  focus: () => void
  insert: (text: string) => void
}

type PromptComposerProps = {
  placeholder?: string
  commands?: SlashCommand[]
  models?: ModelOption[]
  /** While true the send button becomes a stop button */
  streaming?: boolean
  onSubmit?: (submission: ComposerSubmission) => void
  onStop?: () => void
  autoFocus?: boolean
  ref?: Ref<PromptComposerHandle>
}

const MIN_HEIGHT = 41 // one 24px line + text padding
const MAX_HEIGHT = 233 // eight lines + text padding
const MAX_ATTACHMENTS = 10
const WAVE_BARS = 28
const SLASH_QUERY = /^\/[\w-]*$/

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export function PromptComposer({
  placeholder = 'Ask anything, or press / for commands',
  commands = defaultCommands,
  models = defaultModels,
  streaming = false,
  onSubmit,
  onStop,
  autoFocus = true,
  ref,
}: PromptComposerProps) {
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [command, setCommand] = useState<SlashCommand | null>(null)
  const [model, setModel] = useState<ModelOption>(models[1] ?? models[0])
  const [menuDismissed, setMenuDismissed] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [contentHeight, setContentHeight] = useState(MIN_HEIGHT)
  const [dragOver, setDragOver] = useState(false)

  const frameRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)

  const {
    supported: voiceSupported,
    recording,
    elapsed: voiceElapsed,
    start: startVoice,
    cancel: cancelVoice,
    confirm: finishVoice,
    attachBars,
  } = useVoice()

  const reduced = useReducedMotion()
  const spring = useCallback(
    (stiffness: number, damping: number): Transition =>
      reduced ? { duration: 0 } : { type: 'spring', stiffness, damping },
    [reduced],
  )
  const snappy = spring(550, 40)
  const gentle = spring(400, 38)

  // --- slash menu state -------------------------------------------------

  const slashing = command === null && !menuDismissed && SLASH_QUERY.test(text)
  const query = slashing ? text.slice(1).toLowerCase() : ''
  const filtered = slashing
    ? commands.filter((c) => c.name.toLowerCase().includes(query))
    : []
  const menuOpen = slashing && filtered.length > 0

  const handleTextChange = (next: string) => {
    setText(next)
    setActiveIndex(0)
    if (!SLASH_QUERY.test(next)) setMenuDismissed(false)
  }

  const selectCommand = (cmd: SlashCommand) => {
    setCommand(cmd)
    setText('')
    taRef.current?.focus()
  }

  useImperativeHandle(ref, () => ({
    focus: () => taRef.current?.focus(),
    insert: (value: string) => {
      if (recording) return
      handleTextChange(value)
      requestAnimationFrame(() => {
        const ta = taRef.current
        if (!ta) return
        ta.focus()
        ta.setSelectionRange(ta.value.length, ta.value.length)
      })
    },
  }))

  // --- auto-grow --------------------------------------------------------

  const measure = useCallback(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = '0px'
    const raw = ta.scrollHeight
    const next = Math.max(MIN_HEIGHT, Math.min(raw, MAX_HEIGHT))
    ta.style.height = `${next}px`
    ta.style.overflowY = raw > MAX_HEIGHT ? 'auto' : 'hidden'
    setContentHeight(next)
  }, [])

  useLayoutEffect(() => {
    if (!recording) measure()
  }, [text, recording, measure])

  useLayoutEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    document.fonts?.ready.then(measure)
    return () => observer.disconnect()
  }, [measure])

  // --- attachments ------------------------------------------------------

  const addFiles = (files: Iterable<File>) => {
    const next: Attachment[] = []
    for (const file of files) {
      next.push({
        id: crypto.randomUUID(),
        file,
        kind: file.type.startsWith('image/') ? 'image' : 'file',
        url: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      })
    }
    if (next.length === 0) return
    setAttachments((prev) => [...prev, ...next].slice(0, MAX_ATTACHMENTS))
  }

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id)
      if (target?.url) URL.revokeObjectURL(target.url)
      return prev.filter((a) => a.id !== id)
    })
    taRef.current?.focus()
  }

  // --- voice ------------------------------------------------------------

  const confirmVoice = () => {
    const transcript = finishVoice()
    if (transcript) {
      handleTextChange(text ? `${text} ${transcript}` : transcript)
    }
  }

  const wasRecording = useRef(false)
  useEffect(() => {
    if (wasRecording.current && !recording) taRef.current?.focus()
    wasRecording.current = recording
  }, [recording])

  useEffect(() => {
    if (!recording) return
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') cancelVoice()
      if (event.key === 'Enter') {
        event.preventDefault()
        confirmVoice()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  // --- submit -----------------------------------------------------------

  const canSend =
    !streaming && (text.trim().length > 0 || attachments.length > 0)

  const submit = () => {
    if (!canSend) return
    onSubmit?.({ text: text.trim(), command, attachments, model })
    setText('')
    setAttachments([])
    setCommand(null)
  }

  // --- keyboard ---------------------------------------------------------

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (menuOpen) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const delta = event.key === 'ArrowDown' ? 1 : -1
        setActiveIndex(
          (index) => (index + delta + filtered.length) % filtered.length,
        )
        return
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        const active = filtered[activeIndex] ?? filtered[0]
        if (active) selectCommand(active)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        setMenuDismissed(true)
        return
      }
    }
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault()
      submit()
      return
    }
    if (event.key === 'Backspace' && text === '') {
      if (attachments.length > 0) {
        removeAttachment(attachments[attachments.length - 1].id)
      } else if (command) {
        setCommand(null)
      }
    }
  }

  // --- drag & drop ------------------------------------------------------

  const hasFiles = (event: React.DragEvent) =>
    event.dataTransfer.types.includes('Files')

  const showContext = command !== null || attachments.length > 0
  const activePlaceholder = command ? command.hint : placeholder

  const sendState = recording
    ? 'ready'
    : streaming
      ? 'streaming'
      : canSend
        ? 'ready'
        : 'idle'
  const sendIcon = recording ? 'check' : streaming ? 'stop' : 'send'

  return (
    <div
      className="pc-root"
      onDragEnter={(event) => {
        if (!hasFiles(event)) return
        event.preventDefault()
        dragDepth.current += 1
        setDragOver(true)
      }}
      onDragOver={(event) => {
        if (hasFiles(event)) event.preventDefault()
      }}
      onDragLeave={(event) => {
        if (!hasFiles(event)) return
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (dragDepth.current === 0) setDragOver(false)
      }}
      onDrop={(event) => {
        if (!hasFiles(event)) return
        event.preventDefault()
        dragDepth.current = 0
        setDragOver(false)
        addFiles(event.dataTransfer.files)
        taRef.current?.focus()
      }}
    >
      <AnimatePresence>
        {menuOpen && (
          <SlashMenu
            commands={filtered}
            activeIndex={activeIndex}
            onActiveChange={setActiveIndex}
            onSelect={selectCommand}
            transition={snappy}
          />
        )}
      </AnimatePresence>

      <div
        ref={frameRef}
        className="pc-frame"
        onMouseDown={(event) => {
          const target = event.target as HTMLElement
          if (target.closest('button, textarea, input')) return
          event.preventDefault()
          taRef.current?.focus()
        }}
      >
        <AnimatePresence initial={false}>
          {showContext && (
            <motion.div
              key="context"
              className="pc-context-clip"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={gentle}
            >
              <div className="pc-context">
                <AnimatePresence mode="popLayout" initial={false}>
                  {command && (
                    <motion.div
                      key={`pill-${command.id}`}
                      className="pc-pill"
                      layout
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={snappy}
                    >
                      {command.icon}
                      {command.name}
                      <button
                        type="button"
                        className="pc-pill-x"
                        aria-label={`Remove ${command.name} command`}
                        onClick={() => {
                          setCommand(null)
                          taRef.current?.focus()
                        }}
                      >
                        <XIcon size={11} />
                      </button>
                    </motion.div>
                  )}
                  {attachments.map((attachment) => (
                    <motion.div
                      key={attachment.id}
                      className="pc-chip"
                      layout
                      initial={{ opacity: 0, scale: 0.8, filter: 'blur(4px)' }}
                      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, scale: 0.8, filter: 'blur(4px)' }}
                      transition={snappy}
                    >
                      {attachment.kind === 'image' && attachment.url ? (
                        <img
                          className="pc-chip-img"
                          src={attachment.url}
                          alt={attachment.file.name}
                        />
                      ) : (
                        <div className="pc-chip-file">
                          <span className="pc-chip-file-icon">
                            <FileTextIcon size={15} />
                          </span>
                          <span>
                            <span className="pc-chip-file-name">
                              {attachment.file.name}
                            </span>
                            <br />
                            <span className="pc-chip-file-size">
                              {formatSize(attachment.file.size)}
                            </span>
                          </span>
                        </div>
                      )}
                      <button
                        type="button"
                        className="pc-chip-x"
                        aria-label={`Remove ${attachment.file.name}`}
                        onClick={() => removeAttachment(attachment.id)}
                      >
                        <XIcon size={10} />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          className="pc-textwrap"
          initial={false}
          animate={{ height: recording ? MIN_HEIGHT : contentHeight }}
          transition={gentle}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {recording ? (
              <motion.div
                key="wave"
                className="pc-wave"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <div className="pc-wave-bars" ref={attachBars}>
                  {Array.from({ length: WAVE_BARS }, (_, i) => (
                    <span key={i} className="pc-bar" />
                  ))}
                </div>
                <span className="pc-time">{formatTime(voiceElapsed)}</span>
              </motion.div>
            ) : (
              <motion.div
                key="ta"
                className="pc-ta-holder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <AnimatePresence initial={false}>
                  {text === '' && (
                    <motion.span
                      key={activePlaceholder}
                      className="pc-placeholder"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={snappy}
                      aria-hidden
                    >
                      {activePlaceholder}
                    </motion.span>
                  )}
                </AnimatePresence>
                <textarea
                  ref={taRef}
                  className="pc-textarea"
                  rows={1}
                  value={text}
                  autoFocus={autoFocus}
                  aria-label={activePlaceholder}
                  onChange={(event) => handleTextChange(event.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={(event) => {
                    if (event.clipboardData.files.length === 0) return
                    event.preventDefault()
                    addFiles(event.clipboardData.files)
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <div className="pc-toolbar">
          <div className="pc-tools">
            <button
              type="button"
              className="pc-tool"
              aria-label="Attach files"
              disabled={recording}
              onClick={() => fileRef.current?.click()}
            >
              <PlusIcon size={16} />
            </button>
            <button
              type="button"
              className="pc-tool"
              aria-label="Commands"
              disabled={recording}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                if (text === '') {
                  setCommand(null)
                  setMenuDismissed(false)
                  setText('/')
                }
                taRef.current?.focus()
              }}
            >
              <SlashIcon size={15} />
            </button>
          </div>

          <div className="pc-actions">
            <ModelMenu
              models={models}
              selected={model}
              onSelect={(next) => {
                setModel(next)
                taRef.current?.focus()
              }}
              disabled={recording}
              transition={snappy}
            />

            {voiceSupported && (
              <button
                type="button"
                className="pc-tool"
                aria-label={recording ? 'Cancel recording' : 'Voice input'}
                disabled={streaming}
                onClick={() => (recording ? cancelVoice() : startVoice())}
              >
                <AnimatePresence initial={false}>
                  {recording ? (
                    <motion.span
                      key="cancel"
                      className="pc-tool-icon"
                      initial={{ opacity: 0, scale: 0.4, filter: 'blur(3px)' }}
                      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, scale: 0.4, filter: 'blur(3px)' }}
                      transition={snappy}
                    >
                      <XIcon size={15} />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="mic"
                      className="pc-tool-icon"
                      initial={{ opacity: 0, scale: 0.4, filter: 'blur(3px)' }}
                      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, scale: 0.4, filter: 'blur(3px)' }}
                      transition={snappy}
                    >
                      <MicIcon size={15} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            )}

            <motion.button
              type="button"
              className="pc-send"
              data-state={sendState}
              disabled={recording ? false : !streaming && !canSend}
              aria-label={
                recording
                  ? 'Insert transcript'
                  : streaming
                    ? 'Stop response'
                    : 'Send message'
              }
              whileTap={
                canSend || streaming || recording ? { scale: 0.85 } : undefined
              }
              transition={snappy}
              onClick={() =>
                recording ? confirmVoice() : streaming ? onStop?.() : submit()
              }
            >
              <AnimatePresence initial={false}>
                <motion.span
                  key={sendIcon}
                  className="pc-send-icon"
                  initial={{ opacity: 0, scale: 0.4, filter: 'blur(3px)' }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, scale: 0.4, filter: 'blur(3px)' }}
                  transition={snappy}
                >
                  {sendIcon === 'check' ? (
                    <CheckIcon size={15} />
                  ) : sendIcon === 'stop' ? (
                    <StopIcon size={16} />
                  ) : (
                    <ArrowUpIcon size={16} />
                  )}
                </motion.span>
              </AnimatePresence>
            </motion.button>
          </div>
        </div>

        <AnimatePresence>
          {dragOver && (
            <motion.div
              className="pc-drop"
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.99 }}
              transition={{ duration: 0.15 }}
            >
              <span className="pc-drop-label">
                <ImageIcon size={15} />
                Drop files to attach
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          if (event.target.files) addFiles(event.target.files)
          event.target.value = ''
          taRef.current?.focus()
        }}
      />
    </div>
  )
}
