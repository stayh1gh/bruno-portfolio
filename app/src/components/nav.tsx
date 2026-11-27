import { motion } from 'motion/react'
import { CONTACT_EMAIL } from '@/data'
import { cn } from '@/lib/utils'
import { Button, Glare } from './ui/button'
import { TextRoll } from './fx/text-roll'
import { Magnetic } from './fx/magnetic'

export type Panel = 'about' | 'other' | null

export function Nav({ panel, setPanel }: { panel: Panel; setPanel: (p: Panel) => void }) {
  const link = (label: string, on: boolean, onClick: () => void, className?: string) => (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        'group/roll relative h-9 rounded-full px-2.5 text-[15px] outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-accent-2/60 md:px-4 md:text-base',
        on ? 'text-fg' : 'text-muted hover:text-fg',
        className,
      )}
    >
      <TextRoll>{label}</TextRoll>
      {on && (
        <motion.span
          layoutId="nav-dot"
          className="absolute -bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-accent"
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}
    </button>
  )

  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.8, ease: [0.2, 0.7, 0.2, 1] }}
      className="fixed inset-x-0 top-0 z-50"
    >
      <div className="relative mx-auto flex h-[72px] w-full max-w-[2200px] items-center justify-between px-5 md:h-[84px] md:px-8 xl:px-24">
        <a
          href="#top"
          onClick={() => setPanel(null)}
          className="group/roll rounded text-xl font-medium tracking-[-0.03em] outline-none focus-visible:ring-2 focus-visible:ring-accent-2/60 md:text-2xl"
        >
          <TextRoll>bruno.</TextRoll>
        </a>
        <nav aria-label="Main" className="flex items-center gap-0.5 md:gap-2">
          {link('Work', false, () => {
            setPanel(null)
            requestAnimationFrame(() => document.getElementById('work')?.scrollIntoView({ behavior: 'smooth' }))
          }, 'max-sm:hidden')}
          {link('Other work', panel === 'other', () => setPanel(panel === 'other' ? null : 'other'))}
          {link('About', panel === 'about', () => setPanel(panel === 'about' ? null : 'about'))}
          <Magnetic className="ml-1.5 inline-flex md:ml-3">
            <Button asChild size="sm">
              <a href={`mailto:${CONTACT_EMAIL}`}>
                <Glare />
                <TextRoll className="relative">Let’s talk</TextRoll>
              </a>
            </Button>
          </Magnetic>
        </nav>
      </div>
    </motion.header>
  )
}
