# Composer

A prompt input with feel.

The chat input every AI app has, built the way it should feel — spring physics, interruptible animations, and the small details most implementations skip. React + [Motion](https://motion.dev), vanilla CSS, no other dependencies.

> **Status:** v0.1 — early WIP, interface and name will change.

## What it does

- **Auto-grow** — the input grows and shrinks with an interruptible spring as you type, up to 8 lines, then scrolls internally.
- **Slash commands** — type `/` for a filterable command menu with a sliding highlight. Arrow keys, `Enter`/`Tab` to select, `Esc` to dismiss. A selected command becomes a removable pill and swaps the placeholder.
- **Attachments** — paste images, drag & drop, or use the picker. Thumbnails and file chips animate in and reflow with layout animations. `Backspace` on an empty input removes the last chip.
- **Send → stop** — the send arrow morphs into a stop button while a response streams, with a soft pulse ring. Stopping mid-stream actually interrupts.
- **The quiet stuff** — `prefers-reduced-motion` support, labelled controls, IME-safe `Enter`, focus preserved through every mouse interaction.

## Run it

```bash
bun install
bun dev
```

Then open http://localhost:5173 — the demo streams a fake reply so every state is exercisable.

## Structure

```
src/components/composer/
  PromptComposer.tsx   # state, auto-grow, attachments, keyboard
  SlashMenu.tsx        # command menu
  icons.tsx            # hand-rolled SVGs
  composer.css         # all styles, scoped under .pc-*
```

The component only depends on `react` and `motion` — the demo page (`src/App.tsx`) is separate so the composer can be extracted as a package later.

## Roadmap

- `@`-mentions
- Voice input state
- Model picker
- Full combobox ARIA pattern
- Light theme
- Mobile ergonomics
- npm package
