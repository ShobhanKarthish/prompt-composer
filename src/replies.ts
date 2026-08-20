import type { ComposerSubmission } from './components/composer/PromptComposer'

export type ReplyPlan = {
  text: string
  /** ms of "thinking" before the first word */
  delay: number
  /** ms between words */
  interval: number
}

type Variant = (s: ComposerSubmission, excerpt: string) => string

// streaming cadence follows the picked model
const PACE: Record<string, { delay: number; interval: number }> = {
  fast: { delay: 300, interval: 32 },
  balanced: { delay: 700, interval: 55 },
  thinking: { delay: 1700, interval: 72 },
}

const PLAIN: Variant[] = [
  () =>
    'Good question. Wired to a real model, this is where the answer would go — in this demo, the interesting part is how the words arrive.',
  (_s, excerpt) =>
    excerpt
      ? `“${excerpt}” — noted, considered, and streamed back one word at a time so the stop button has a reason to exist.`
      : 'Noted, considered, and streamed back one word at a time so the stop button has a reason to exist.',
  () =>
    'Short answer: yes. Long answer: every animation here is a spring, not a duration curve — which is most of why it feels the way it feels.',
  () =>
    'A real backend would take it from here. Meanwhile the input is fully real — try the mic, or drop a file straight onto it.',
  (_s, excerpt) =>
    excerpt
      ? `Considered “${excerpt}” from several angles. Conclusion: worth asking again in an app with a model attached.`
      : 'Considered it from several angles. Conclusion: worth asking again in an app with a model attached.',
]

const COMMANDS: Record<string, Variant[]> = {
  summarize: [
    (s) => {
      const count = s.text.split(/\s+/).filter(Boolean).length
      return count < 8
        ? `That’s already a summary — ${count} word${count === 1 ? '' : 's'} is about as distilled as language gets.`
        : `Summary of your ${count} words: the beginning set the scene, the middle did the work, and the ending knew when to stop.`
    },
    () =>
      'TL;DR: it’s shorter now. A real model would keep the meaning too — this demo only keeps the pacing.',
  ],
  translate: [
    (_s, excerpt) =>
      excerpt
        ? `Translated flawlessly into Demo-ese, the only language this build ships with. «${excerpt}» does sound better with guillemets though.`
        : 'Translated flawlessly into Demo-ese, the only language this build ships with.',
    () =>
      'Happily — though the only thing fluent here is the spring physics. Wire up a model and this becomes a real translation.',
  ],
  code: [
    () =>
      'function answer() { return "hook this to a real model and it writes code — today it writes this sentence" } // resolves instantly, unlike CI',
    () =>
      'Reviewed. Verdict: ship it — pending a real model, actual tests, and any code.',
  ],
  image: [
    () =>
      'Picture it: the image you described, rendered right here. This demo stops at the picturing stage — paste one into the input instead, it’ll take it.',
    () =>
      'Generating… done, in the theater of the mind. The attachment flow is real though — drop an image on the input and watch the chips.',
  ],
  research: [
    () =>
      'Deep dive complete: three sources consulted, two disagreed, and one footnote turned out to be load-bearing. Full citations sold separately.',
    () =>
      'Researched thoroughly for exactly zero milliseconds. The streaming, stopping, and interrupting, however — all genuine.',
  ],
}

const FILES_ONLY: Variant[] = [
  (s) => {
    const n = s.attachments.length
    return `${n} file${n === 1 ? '' : 's'} received and inspected closely by absolutely nothing. In a real app this is where parsing would happen — here, they’re simply admired.`
  },
  (s) => {
    const n = s.attachments.length
    const them = n === 1 ? 'it' : 'them'
    return `Got ${n === 1 ? 'it' : `all ${n}`}. A model would read ${them} — the composer’s job was getting ${them} here looking good, and that part’s done.`
  },
]

const lastIndex = new Map<unknown, number>()

function pick(pool: Variant[]): Variant {
  let index = Math.floor(Math.random() * pool.length)
  const last = lastIndex.get(pool)
  if (pool.length > 1 && index === last) index = (index + 1) % pool.length
  lastIndex.set(pool, index)
  return pool[index]
}

function excerptOf(text: string, words = 5): string {
  const parts = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  if (parts.length === 0) return ''
  const head = parts.slice(0, words).join(' ')
  return parts.length > words ? `${head}…` : head
}

export function composeReply(submission: ComposerSubmission): ReplyPlan {
  const pace = PACE[submission.model.id] ?? PACE.balanced
  const excerpt = excerptOf(submission.text)

  const pool = submission.command
    ? (COMMANDS[submission.command.id] ?? PLAIN)
    : submission.attachments.length > 0 && submission.text.trim() === ''
      ? FILES_ONLY
      : PLAIN

  let text = pick(pool)(submission, excerpt)

  const files = submission.attachments.length
  if (files > 0 && pool !== FILES_ONLY) {
    text = `${files} file${files === 1 ? '' : 's'} received. ${text}`
  }

  return { text, ...pace }
}
