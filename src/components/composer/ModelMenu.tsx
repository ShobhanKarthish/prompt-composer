import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Transition } from 'motion/react'
import { CheckIcon, ChevronDownIcon } from './icons'
import type { ModelOption } from './models'

type ModelMenuProps = {
  models: ModelOption[]
  selected: ModelOption
  onSelect: (model: ModelOption) => void
  disabled?: boolean
  transition: Transition
}

export function ModelMenu({
  models,
  selected,
  onSelect,
  disabled,
  transition,
}: ModelMenuProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="pc-model" ref={rootRef}>
      <button
        type="button"
        className="pc-model-chip"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setActiveIndex(Math.max(0, models.findIndex((m) => m.id === selected.id)))
          setOpen((value) => !value)
        }}
      >
        {selected.name}
        <motion.span
          className="pc-model-caret"
          animate={{ rotate: open ? 180 : 0 }}
          transition={transition}
        >
          <ChevronDownIcon size={12} />
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="pc-menu pc-menu-model"
            role="listbox"
            aria-label="Model"
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
            {models.map((model, index) => (
              <button
                key={model.id}
                type="button"
                className="pc-item"
                role="option"
                aria-selected={model.id === selected.id}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => {
                  onSelect(model)
                  setOpen(false)
                }}
              >
                {index === activeIndex && (
                  <motion.div
                    layoutId="pc-model-hl"
                    className="pc-hl"
                    transition={transition}
                  />
                )}
                <span className="pc-item-col">
                  <span className="pc-item-name">{model.name}</span>
                  <span className="pc-item-desc">{model.description}</span>
                </span>
                {model.id === selected.id && (
                  <motion.span
                    className="pc-item-check"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={transition}
                  >
                    <CheckIcon size={14} />
                  </motion.span>
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
