import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { Galaxy } from './galaxy'

/**
 * The space scene behind the whole page, fixed to the screen:
 * the painted backdrop (generated with Magnific from its anime galaxy set, tinted navy)
 * drifting very slowly, with twinkling stars and comets on top.
 * It gets darker as you scroll down, so the work section sits on a deep, quiet sky.
 */
export function SpaceBackdrop() {
  const reduce = useReducedMotion()
  const { scrollY } = useScroll()
  // 0 at the top → ~0.6 one screen down → ~0.85 two screens down and beyond.
  const darkness = useTransform(scrollY, (y) => {
    const vh = typeof window === 'undefined' ? 900 : window.innerHeight
    const k = Math.min(1, y / (vh * 2))
    return 0.88 * (1 - (1 - k) * (1 - k))
  })

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg">
      <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.6, ease: 'easeOut' }}>
        <motion.img
          src="/images/story/space-2560.webp"
          srcSet="/images/story/space-1280.webp 1280w, /images/story/space-2560.webp 2560w"
          sizes="100vw"
          alt=""
          className="absolute inset-0 size-full object-cover"
          initial={{ scale: 1.08, x: '-1.5%', y: '0%' }}
          animate={reduce ? undefined : { scale: [1.08, 1.14, 1.08], x: ['-1.5%', '1.5%', '-1.5%'], y: ['0%', '-1.5%', '0%'] }}
          transition={{ duration: 60, repeat: Infinity, ease: 'easeInOut' }}
        />
        <Galaxy overlay className="absolute inset-0 size-full" />
      </motion.div>
      <motion.div className="absolute inset-0 bg-black" style={{ opacity: darkness }} />
    </div>
  )
}
