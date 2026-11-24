import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react'
import { cn } from '@/lib/utils'

/**
 * Custom cursor: a small dot that sits exactly on the pointer, and a neon ring (the
 * loader's colour) that trails behind it on a spring.
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
  const spring = reduce ? { stiffness: 2000, damping: 100 } : { stiffness: 520, damping: 38, mass: 0.5 }
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

  const ring = {
    default: { size: 34, fill: 'rgb(91 134 255 / 0)', border: 'rgb(169 226 255 / 0.55)' },
    link: { size: 54, fill: 'rgb(91 134 255 / 0.14)', border: 'rgb(169 226 255 / 0.8)' },
    view: { size: 92, fill: 'rgb(91 134 255 / 0.92)', border: 'rgb(169 226 255 / 0.9)' },
  }[mode]

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[100]">
      {/* Ring: trails the pointer */}
      <motion.div className="absolute left-0 top-0" style={{ x: rx, y: ry }}>
        <motion.div
          className="grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border backdrop-blur-[1px]"
          initial={false}
          animate={{
            width: ring.size,
            height: ring.size,
            backgroundColor: ring.fill,
            borderColor: ring.border,
            opacity: visible ? 1 : 0,
            scale: down ? 0.82 : 1,
            boxShadow: mode === 'view' ? '0 0 32px rgb(79 141 255 / 0.55)' : '0 0 14px rgb(79 141 255 / 0.35)',
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
                className="text-[13px] font-medium tracking-[-0.01em] text-bg"
              >
                {label}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>

      {/* Dot: exactly on the pointer */}
      <motion.div className="absolute left-0 top-0" style={{ x, y }}>
        <motion.div
          className={cn('-translate-x-1/2 -translate-y-1/2 rounded-full bg-fg')}
          initial={false}
          animate={{ width: 6, height: 6, opacity: visible && mode !== 'view' ? 1 : 0, scale: mode === 'link' ? 0.6 : 1 }}
          transition={{ duration: 0.18 }}
        />
      </motion.div>
    </div>
  )
}
