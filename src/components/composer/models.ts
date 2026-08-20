export type ModelOption = {
  id: string
  name: string
  description: string
}

export const defaultModels: ModelOption[] = [
  { id: 'fast', name: 'Fast', description: 'Instant, lighter answers' },
  { id: 'balanced', name: 'Balanced', description: 'Everyday quality' },
  { id: 'thinking', name: 'Thinking', description: 'Slower, deeper reasoning' },
]
