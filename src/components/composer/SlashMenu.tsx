import { motion } from 'motion/react'
import type { Transition } from 'motion/react'
import type { SlashCommand } from './PromptComposer'

type SlashMenuProps = {
  commands: SlashCommand[]
  activeIndex: number
  onActiveChange: (index: number) => void
  onSelect: (command: SlashCommand) => void
  transition: Transition
}

export function SlashMenu({
  commands,
  activeIndex,
  onActiveChange,
  onSelect,
  transition,
}: SlashMenuProps) {
  return (
    <motion.div
      className="pc-menu"
      role="listbox"
      aria-label="Commands"
      initial={{ opacity: 0, scale: 0.95, y: 6, filter: 'blur(4px)' }}
      animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
      exit={{
        opacity: 0,
        scale: 0.97,
        y: 4,
        filter: 'blur(2px)',
        transition: { duration: 0.12, ease: 'easeIn' },
      }}
      transition={transition}
    >
      <div className="pc-menu-header">Commands</div>
      {commands.map((command, index) => {
        const active = index === activeIndex
        return (
          <button
            key={command.id}
            id={`pc-cmd-${command.id}`}
            type="button"
            className="pc-item"
            role="option"
            aria-selected={active}
            tabIndex={-1}
            onMouseEnter={() => onActiveChange(index)}
            // mousedown, not click — the textarea must not lose focus
            onMouseDown={(event) => {
              event.preventDefault()
              onSelect(command)
            }}
          >
            {active && (
              <motion.div
                layoutId="pc-hl"
                className="pc-hl"
                style={{ zIndex: 0 }}
                transition={transition}
              />
            )}
            <span className="pc-item-icon">{command.icon}</span>
            <span className="pc-item-name">{command.name}</span>
            <span className="pc-item-desc">{command.description}</span>
            {active && (
              <motion.span
                className="pc-item-kbd"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                ↵
              </motion.span>
            )}
          </button>
        )
      })}
    </motion.div>
  )
}
