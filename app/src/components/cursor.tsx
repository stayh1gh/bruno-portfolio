import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react'

/**
 * Custom cursor: a single frosted-glass ring (see-through, blurring what's under it)
 * that follows the pointer.
 * - Over links and buttons the ring grows and fills softly.
 * - Over a project card (`data-cursor="view"`) it becomes a filled disc that says "View".
 * - It shrinks a little while pressed and hides when the pointer leaves the window.
 * Only for mouse / trackpad: touch screens keep the normal behaviour.
 */
type Mode = 'default' | 'link' | 'view'

const INTERACTIVE = 'a, button, [role="tab"], [role="button"], label, summary, [data-cursor="link"]'

export function Cursor() {
  const [enabled, setEnabled] = useState(false)
  const [mode, setMode] = useState<Mode>('default')
  const [label, setLabel] = useState('View')
  const [visible, setVisible] = useState(false)
  const [down, setDown] = useState(false)
  const reduce = useReducedMotion()

  const x = useMotionValue(-100)
  const y = useMotionValue(-100)
  const spring = reduce ? { stiffness: 2000, damping: 100 } : { stiffness: 900, damping: 55, mass: 0.3 } // only a ring now: it stays close to the pointer
  const rx = useSpring(x, spring)
  const ry = useSpring(y, spring)

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)')
    const on = () => setEnabled(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  useEffect(() => {
    if (!enabled) return
    const html = document.documentElement
    html.classList.add('custom-cursor')

    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      x.set(e.clientX)
      y.set(e.clientY)
      setVisible(true)
      const t = e.target as Element | null
      const view = t?.closest<HTMLElement>('[data-cursor="view"]')
      if (view) {
        setMode('view')
        setLabel(view.dataset.cursorLabel ?? 'View')
      } else setMode(t?.closest(INTERACTIVE) ? 'link' : 'default')
    }
    const leave = () => setVisible(false)
    const press = () => setDown(true)
    const release = () => setDown(false)

    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerdown', press)
    window.addEventListener('pointerup', release)
    document.addEventListener('pointerleave', leave)
    window.addEventListener('blur', leave)
    return () => {
      html.classList.remove('custom-cursor')
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', press)
      window.removeEventListener('pointerup', release)
      document.removeEventListener('pointerleave', leave)
      window.removeEventListener('blur', leave)
    }
  }, [enabled, x, y])

  if (!enabled) return null

  // A frosted-glass ring: see-through, softly blurring what's under it.
  const ring = {
    default: { size: 24, fill: 'rgb(243 236 214 / 0.08)', border: 'rgb(243 236 214 / 0.4)' },
    link: { size: 40, fill: 'rgb(243 236 214 / 0.14)', border: 'rgb(243 236 214 / 0.55)' },
    view: { size: 76, fill: 'rgb(91 134 255 / 0.55)', border: 'rgb(185 213 255 / 0.6)' },
  }[mode]

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[100]">
      <motion.div className="absolute left-0 top-0" style={{ x: rx, y: ry }}>
        <motion.div
          className="grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border"
          initial={false}
          animate={{
            width: ring.size,
            height: ring.size,
            backgroundColor: ring.fill,
            borderColor: ring.border,
            opacity: visible ? 1 : 0,
            scale: down ? 0.82 : 1,
            // Blur what's under the ring, except over links so their text stays readable.
            backdropFilter: mode === 'link' ? 'blur(0px)' : 'blur(6px)',
            boxShadow: mode === 'view' ? '0 0 28px rgb(79 141 255 / 0.4)' : '0 2px 12px rgb(0 0 0 / 0.25)',
          }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        >
          <AnimatePresence>
            {mode === 'view' && (
              <motion.span
                key={label}
                initial={{ opacity: 0, scale: 0.6, filter: 'blur(4px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.12 } }}
                transition={{ duration: 0.25 }}
                className="text-[13px] font-medium tracking-[-0.01em] text-fg"
              >
                {label}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>

    </div>
  )
}
