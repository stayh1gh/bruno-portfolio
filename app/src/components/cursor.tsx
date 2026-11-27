import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useMotionValue } from 'motion/react'

/**
 * Custom cursor: a single frosted-glass ring (see-through, blurring what's under it)
 * that sits exactly on the pointer. Its position is written straight from the pointer event, with
 * no easing: a spring here made the ring trail the hand (about 60ms behind, so tens of pixels at
 * normal speeds), which read as lag. Only its size and colour are eased.
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
  const x = useMotionValue(-100)
  const y = useMotionValue(-100)
  // What the pointer is over, kept outside React so a move only re-renders when it changes.
  const over = useRef<{ mode: Mode; label: string; visible: boolean }>({ mode: 'default', label: 'View', visible: false })

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
      const o = over.current
      if (!o.visible) {
        o.visible = true
        setVisible(true)
      }
      const t = e.target instanceof Element ? e.target : null
      const view = t?.closest<HTMLElement>('[data-cursor="view"]')
      const next: Mode = view ? 'view' : t?.closest(INTERACTIVE) ? 'link' : 'default'
      if (next !== o.mode) {
        o.mode = next
        setMode(next)
      }
      const nextLabel = view?.dataset.cursorLabel ?? 'View'
      if (view && nextLabel !== o.label) {
        o.label = nextLabel
        setLabel(nextLabel)
      }
    }
    const leave = () => {
      over.current.visible = false
      setVisible(false)
    }
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
    default: { size: 24, fill: 'rgb(232 238 248 / 0.08)', border: 'rgb(232 238 248 / 0.4)' },
    link: { size: 40, fill: 'rgb(232 238 248 / 0.14)', border: 'rgb(232 238 248 / 0.55)' },
    view: { size: 76, fill: 'rgb(91 134 255 / 0.55)', border: 'rgb(185 213 255 / 0.6)' },
  }[mode]

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[100]">
      <motion.div className="absolute left-0 top-0 will-change-transform" style={{ x, y }}>
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
