import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { TextRoll } from './fx/text-roll'
import { pauseSmoothScroll } from '@/lib/smooth-scroll'

type Props = {
  open: boolean
  label: string
  onClose: () => void
  children: (scrollRef: RefObject<HTMLDivElement | null>) => ReactNode
}

/**
 * Full-screen panel over the page (the page stays visible, blurred, behind it).
 * The navbar stays on top so its links can switch between panels.
 */
export function Overlay({ open, label, onClose, children }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const html = document.documentElement
    html.style.overflow = 'hidden'
    pauseSmoothScroll(true)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const t = setTimeout(() => closeRef.current?.focus({ preventScroll: true }), 50)
    return () => {
      html.style.overflow = ''
      pauseSmoothScroll(false)
      window.removeEventListener('keydown', onKey)
      clearTimeout(t)
      opener?.focus?.({ preventScroll: true })
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div key={label} role="dialog" aria-modal="true" aria-label={label} className="fixed inset-0 z-40">
          <motion.div
            className="absolute inset-0 bg-bg/75 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.35, delay: 0.05 } }}
            transition={{ duration: 0.45 }}
          />
          <motion.div
            ref={scrollRef}
            data-lenis-prevent
            className="absolute inset-0 overflow-y-auto overscroll-contain pb-24 pt-[104px] [mask-image:linear-gradient(to_bottom,transparent_0,transparent_64px,black_120px)] md:pt-[128px] md:[mask-image:linear-gradient(to_bottom,transparent_0,transparent_76px,black_132px)]"
            onClick={(e) => e.target === e.currentTarget && onClose()}
            initial={{ opacity: 0, y: 48, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 24, filter: 'blur(6px)', transition: { duration: 0.3 } }}
            transition={{ type: 'spring', stiffness: 120, damping: 22 }}
          >
            <div className="mx-auto w-full max-w-[1248px] px-5 md:px-8 xl:px-0" onClick={(e) => e.target === e.currentTarget && onClose()}>
              <div className="flex justify-end">
                <button
                  ref={closeRef}
                  onClick={onClose}
                  className="group/roll inline-flex h-8 items-center gap-2 rounded-full border border-line px-3 text-[15px] text-muted outline-none transition-colors hover:border-fg/25 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent-2/60"
                >
                  <X className="size-3.5 transition-transform duration-500 group-hover/roll:rotate-90" />
                  <TextRoll>Close</TextRoll>
                  <kbd className="ml-1 hidden rounded border border-line px-1 font-mono text-[11px] text-subtle md:inline">esc</kbd>
                </button>
              </div>
              {children(scrollRef)}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
