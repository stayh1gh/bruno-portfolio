import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react'
import { STORY, type StoryStyle } from '@/data'
import { cn } from '@/lib/utils'
import { NeonRing, type RingHandle } from './neon-ring'

// ── Flatten the story into typed units ───────────────────────────────────────────────
type Char = { ch: string; s?: StoryStyle; i: number }
type Unit = { kind: 'word'; start: number; end: number; chars: Char[] } | { kind: 'space'; i: number; s?: StoryStyle } | { kind: 'br'; i: number }

function flatten() {
  const units: Unit[] = []
  let i = 0
  let word: Char[] | null = null
  const closeWord = () => {
    if (word && word.length) units.push({ kind: 'word', start: word[0].i, end: word[word.length - 1].i + 1, chars: word })
    word = null
  }
  for (const seg of STORY) {
    if ('br' in seg) {
      closeWord()
      units.push({ kind: 'br', i: i++ })
      continue
    }
    for (const ch of seg.t) {
      if (ch === ' ') {
        closeWord()
        units.push({ kind: 'space', i: i++, s: seg.s })
      } else {
        ;(word ??= []).push({ ch, s: seg.s, i: i++ })
      }
    }
  }
  closeWord()
  return { units, total: i }
}

const STYLE: Record<StoryStyle, string> = {
  b: 'font-semibold',
  s: 'font-serif italic font-normal tracking-normal text-[1.08em]',
  a: 'text-accent',
  c: 'text-accent-2',
}

const BASE_CPS = 26 // characters per second when nobody scrolls
const START_DELAY = 1500 // ms of "listening" before the first letter
const MAX_SCALE = 3 // camera zoom at the first letter

export function Story() {
  const reduce = useReducedMotion()
  const { units, total } = useMemo(flatten, [])
  const wordEnds = useMemo(() => units.flatMap((u) => (u.kind === 'word' ? [u.end] : [])), [units])

  const containerRef = useRef<HTMLDivElement>(null)
  const blockRef = useRef<HTMLParagraphElement>(null)
  const ringRef = useRef<RingHandle>(null)

  const [n, setN] = useState(0)
  const nRef = useRef(0)
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start start', 'end end'] })

  // ── Typing: time drives it, scrolling fast-forwards it ──────────────────────────────
  useEffect(() => {
    if (reduce) {
      nRef.current = total
      setN(total)
      return
    }
    const chars = units.flatMap((u) => (u.kind === 'word' ? u.chars.map((c) => c.ch) : [u.kind === 'br' ? '\n' : ' ']))
    let raf = 0
    let last = performance.now()
    const startAt = last + START_DELAY
    let holdUntil = 0
    let acc = nRef.current
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const scrollTarget = Math.min(1, scrollYProgress.get() / 0.62) * total
      const forced = scrollTarget > acc + 0.5
      let speed = now < startAt || now < holdUntil ? 0 : BASE_CPS
      if (forced) speed = Math.max(speed, (scrollTarget - acc) * 7, 70)
      const prev = Math.floor(acc)
      acc = Math.min(total, acc + speed * dt)
      const next = Math.floor(acc)
      if (next !== prev) {
        const ch = chars[next - 1]
        if (!forced) holdUntil = now + (ch === '.' ? 380 : ch === ',' ? 160 : ch === '\n' ? 220 : 0)
        nRef.current = next
        setN(next)
      }
      if (acc < total) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reduce, scrollYProgress, total, units])

  // The ring pulses every time a word lands.
  const wordsDone = useRef(0)
  useEffect(() => {
    let k = 0
    while (k < wordEnds.length && wordEnds[k] <= n) k++
    if (k > wordsDone.current) ringRef.current?.pulse(Math.min(2, k - wordsDone.current))
    wordsDone.current = k
  }, [n, wordEnds])

  // ── Camera: zoomed in on the first letter, pulls back as the paragraph grows ────────
  const [vp, setVp] = useState({ w: 1440, h: 900 })
  useLayoutEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    on()
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  const [box, setBox] = useState({ w: 0, h: 0 })
  const boxH = useMotionValue(0)
  useLayoutEffect(() => {
    const el = blockRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setBox({ w: el.offsetWidth, h: el.offsetHeight })
      boxH.set(nRef.current === 0 ? 0 : el.offsetHeight)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [boxH])

  const mobile = vp.w < 768
  const fitW = vp.w * (mobile ? 0.88 : 0.64)
  const fitH = vp.h * (mobile ? 0.56 : 0.5)
  const target = box.w && box.h && n > 0 ? Math.min(MAX_SCALE, fitW / box.w, fitH / box.h) : MAX_SCALE
  const scale = useSpring(MAX_SCALE, { stiffness: 110, damping: 24, mass: 1 })
  useEffect(() => {
    if (reduce) scale.jump(target)
    else scale.set(target)
  }, [target, reduce, scale])

  // Ring: alone in the centre while "listening", then floats above the text and shrinks.
  const ringSize = n === 0 ? (mobile ? 104 : 128) : mobile ? 64 : Math.round(92 - 28 * (n / total))
  const ringYRaw = useTransform(() => {
    const h = boxH.get()
    return h === 0 ? 0 : -(h * scale.get()) / 2 - (mobile ? 28 : 40) - ringSize / 2
  })
  const ringY = useSpring(ringYRaw, { stiffness: 90, damping: 20 })

  // Leaving: the story dims and recedes as the work section comes up.
  const exitOpacity = useTransform(scrollYProgress, [0.82, 1], [1, 0.35])
  const exitScale = useTransform(scrollYProgress, [0.82, 1], [1, 0.94])
  const exitBlur = useTransform(scrollYProgress, [0.82, 1], ['blur(0px)', 'blur(4px)'])

  const done = n >= total

  return (
    <section ref={containerRef} aria-label="Intro" className="relative h-[230svh]">
      <p className="sr-only">
        {STORY.map((s) => ('br' in s ? ' ' : s.t)).join('')}
      </p>
      <div className="sticky top-0 flex h-svh items-center justify-center overflow-hidden">
        <motion.div aria-hidden className="relative flex items-center justify-center" style={{ opacity: exitOpacity, scale: exitScale, filter: exitBlur }}>
          <motion.div className="absolute" style={{ y: ringY }} initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.4, ease: [0.2, 0.7, 0.2, 1] }}>
            <motion.div initial={false} animate={{ width: ringSize, height: ringSize }} transition={{ type: 'spring', stiffness: 80, damping: 18 }}>
              <NeonRing ref={ringRef} size="100%" />
            </motion.div>
          </motion.div>

          <motion.p
            ref={blockRef}
            style={{ scale }}
            className={cn(
              'text-center font-sans font-medium text-fg [text-wrap:balance]',
              'max-w-[330px] text-[26px] leading-[1.28] tracking-[-0.02em]',
              'md:w-max md:max-w-none md:text-[46px] md:leading-[1.36] md:tracking-[-0.025em]',
            )}
          >
            {units.map((u, k) => {
              if (u.kind === 'br')
                return u.i < n ? (
                  <span key={k}>
                    <br className="max-md:hidden" />
                    <span className="md:hidden"> </span>
                  </span>
                ) : null
              if (u.kind === 'space') return u.i < n ? <span key={k} className={u.s === 's' ? 'font-serif italic' : undefined}> </span> : null
              if (u.start >= n) return null
              return (
                <span key={k} className="inline-block whitespace-nowrap">
                  {u.chars.map((c) =>
                    c.i < n ? (
                      <span key={c.i} className={cn('char', c.s && STYLE[c.s])}>
                        {c.ch}
                      </span>
                    ) : null,
                  )}
                </span>
              )
            })}
            {n > 0 && (
              <span
                className={cn('caret ml-[0.06em] inline-block h-[0.95em] w-[3px] translate-y-[0.14em] rounded-full bg-accent', done && 'opacity-80')}
              />
            )}
          </motion.p>
        </motion.div>

        <ScrollCue done={done} progress={n / total} />
      </div>
    </section>
  )
}

function ScrollCue({ done, progress }: { done: boolean; progress: number }) {
  return (
    <div className="pointer-events-none absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3 md:bottom-11">
      <MouseIcon />
      <div className="relative h-4 w-60 overflow-hidden text-center">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={done ? 'done' : 'typing'}
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '-100%', opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.7, 0, 0.2, 1] }}
            className="block font-mono text-[10px] uppercase tracking-[0.22em] text-subtle"
          >
            {done ? 'Scroll to see the work' : 'Scroll to fast-forward'}
          </motion.span>
        </AnimatePresence>
      </div>
      <motion.div
        className="h-[2px] overflow-hidden rounded-full bg-line"
        animate={{ width: done ? 6 : 240, height: done ? 6 : 2 }}
        transition={{ type: 'spring', stiffness: 160, damping: 20 }}
      >
        <div className="h-full w-full origin-left bg-accent" style={{ transform: `scaleX(${progress})` }} />
      </motion.div>
    </div>
  )
}

function MouseIcon() {
  return (
    <svg width="16" height="24" viewBox="0 0 16 24" fill="none" className="text-subtle" aria-hidden>
      <rect x="1" y="1" width="14" height="22" rx="7" stroke="currentColor" strokeWidth="1.5" />
      <rect x="7.25" y="5" width="1.5" height="4.5" rx="0.75" fill="currentColor" style={{ animation: 'wheel 1.6s ease-in-out infinite' }} />
    </svg>
  )
}
