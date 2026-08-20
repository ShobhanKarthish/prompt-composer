import type { SlashCommand } from './PromptComposer'
import {
  CodeIcon,
  FileTextIcon,
  GlobeIcon,
  ImageIcon,
  SparklesIcon,
} from './icons'

export const defaultCommands: SlashCommand[] = [
  {
    id: 'summarize',
    name: 'summarize',
    description: 'Condense text or a page',
    hint: 'What should I summarize?',
    icon: <SparklesIcon size={14} />,
  },
  {
    id: 'translate',
    name: 'translate',
    description: 'Between any two languages',
    hint: 'What should I translate?',
    icon: <GlobeIcon size={14} />,
  },
  {
    id: 'code',
    name: 'code',
    description: 'Write or review code',
    hint: 'Describe the code you need…',
    icon: <CodeIcon size={14} />,
  },
  {
    id: 'image',
    name: 'image',
    description: 'Generate an image',
    hint: 'Describe the image…',
    icon: <ImageIcon size={14} />,
  },
  {
    id: 'research',
    name: 'research',
    description: 'Deep dive with sources',
    hint: 'What should I research?',
    icon: <FileTextIcon size={14} />,
  },
]
