import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react'
import { STORY, type StoryStyle } from '@/data'
import { cn } from '@/lib/utils'
import { keyClick } from '@/lib/typing-sound'
import { NeonRing, type RingHandle } from './neon-ring'

// ── Flatten the story into typed units ───────────────────────────────────────────────
type Char = { ch: string; s?: StoryStyle; i: number }
type Unit = { kind: 'word'; start: number; end: number; chars: Char[] } | { kind: 'space'; i: number; s?: StoryStyle } | { kind: 'br'; i: number }

function flatten() {
  const units: Unit[] = []
  let text = ''
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
      text += '\n'
      continue
    }
    for (const ch of seg.t) {
      if (ch === ' ') {
        closeWord()
        units.push({ kind: 'space', i: i++, s: seg.s })
      } else {
        ;(word ??= []).push({ ch, s: seg.s, i: i++ })
      }
      text += ch
    }
  }
  closeWord()
  return { units, total: i, text }
}

const STYLE: Record<StoryStyle, string> = {
  b: 'font-semibold',
  s: 'font-serif italic font-normal tracking-normal text-[1.08em]',
  a: 'text-accent',
  c: 'text-accent-2',
}

// ── Pacing ───────────────────────────────────────────────────────────────────────────
// 1. The ring loads alone.
// 2. Zoomed in, line 1 is typed ("Hi, I’m Bruno Paradas, a Design Engineer from Brazil.").
// 3. A pause. Then the next lines are typed and the camera pulls back a little with
//    every letter, until "…multidisciplinary teams."
// 4. Another pause. Then the rest is typed while the camera pulls back to its final size.
const LOADER_MS = 1600
const HOLD_MS = 1600 // the two pauses
const LINE1_CPS = 15
const STORY_CPS = 13
const PAUSE = { '.': 420, ',': 200, '\n': 320, ' ': 0 } as Record<string, number>

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.min(1, Math.max(0, t))
}

const TEXT_CLASS = cn(
  'text-center font-sans font-medium text-fg [text-wrap:balance]',
  'max-w-[262px] text-[17px] leading-[1.45] tracking-[-0.01em]',
  'md:w-max md:max-w-none md:text-[30px] md:leading-[1.42] md:tracking-[-0.02em]',
)

function renderUnits(units: Unit[], limit: number, animate: boolean): ReactNode[] {
  return units.map((u, k) => {
    if (u.kind === 'br')
      return u.i < limit ? (
        <span key={k}>
          <br className="max-md:hidden" />
          <span className="md:hidden"> </span>
        </span>
      ) : null
    if (u.kind === 'space') return u.i < limit ? <span key={k} className={u.s === 's' ? 'font-serif italic' : undefined}> </span> : null
    if (u.start >= limit) return null
    return (
      <span key={k} className="inline-block whitespace-nowrap">
        {u.chars.map((c) =>
          c.i < limit ? (
            <span key={c.i} className={cn(animate ? 'char' : 'inline-block whitespace-pre', c.s && STYLE[c.s])}>
              {c.ch}
            </span>
          ) : null,
        )}
      </span>
    )
  })
}

/** Measures the unscaled size of the story typed up to `limit`, without showing it. */
function useGhostSize(ref: RefObject<HTMLParagraphElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    void document.fonts?.ready.then(measure)
    return () => ro.disconnect()
  }, [ref])
  return size
}

export function Story() {
  const reduce = useReducedMotion()
  const { units, total, text } = useMemo(flatten, [])
  const line1End = text.indexOf('Brazil.') + 'Brazil.'.length
  const part2End = text.indexOf('teams.') + 'teams.'.length
  const wordEnds = useMemo(() => units.flatMap((u) => (u.kind === 'word' ? [u.end] : [])), [units])

  const containerRef = useRef<HTMLDivElement>(null)
  const blockRef = useRef<HTMLParagraphElement>(null)
  const ghost1 = useRef<HTMLParagraphElement>(null)
  const ghost2 = useRef<HTMLParagraphElement>(null)
  const ghost3 = useRef<HTMLParagraphElement>(null)
  const ringRef = useRef<RingHandle>(null)

  const [n, setN] = useState(0)
  const nRef = useRef(0)
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start start', 'end end'] })

  // ── Camera scales for the three stops ───────────────────────────────────────────────
  const [vp, setVp] = useState({ w: 1440, h: 900 })
  useLayoutEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    on()
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  const g1 = useGhostSize(ghost1)
  const g2 = useGhostSize(ghost2)
  const g3 = useGhostSize(ghost3)
  const mobile = vp.w < 768
  const fit = (g: { w: number; h: number }, wf: number, hf: number) => (g.w && g.h ? Math.min((vp.w * wf) / g.w, (vp.h * hf) / g.h) : 1)
  const s1 = Math.min(mobile ? 1.6 : 2.8, fit(g1, mobile ? 0.9 : 0.94, 0.5)) // zoomed in on line 1
  const s2 = Math.min(s1, fit(g2, mobile ? 0.9 : 0.86, mobile ? 0.56 : 0.5)) // after "teams."
  const s3 = Math.min(s2, mobile ? 1 : 1.5, fit(g3, mobile ? 0.9 : 0.84, mobile ? 0.56 : 0.52)) // the whole story
  const stops = useRef({ s1, s2, s3 })
  stops.current = { s1, s2, s3 }

  const scaleTarget = useMotionValue(1)
  const scale = useSpring(scaleTarget, { stiffness: 140, damping: 30 })
  const scaleFor = (acc: number) => {
    const { s1, s2, s3 } = stops.current
    if (acc <= line1End) return s1
    if (acc <= part2End) return lerp(s1, s2, (acc - line1End) / (part2End - line1End))
    return lerp(s2, s3, (acc - part2End) / (total - part2End))
  }
  // Keep the camera right when the stops are measured or the window changes.
  useEffect(() => {
    scaleTarget.set(scaleFor(nRef.current))
    if (reduce || nRef.current === 0) scale.jump(scaleFor(nRef.current))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s1, s2, s3, reduce])

  // ── Typing ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (reduce) {
      nRef.current = total
      setN(total)
      return
    }
    let raf = 0
    let last = performance.now()
    let holdUntil = last + LOADER_MS
    let acc = nRef.current
    let jitter = 1
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const scrollTarget = Math.min(1, scrollYProgress.get() / 0.62) * total
      const forced = scrollTarget > acc + 0.5
      let speed = now < holdUntil ? 0 : (acc < line1End ? LINE1_CPS : STORY_CPS) * jitter
      if (forced) speed = Math.max(speed, (scrollTarget - acc) * 5, 45)
      const prev = Math.floor(acc)
      acc = Math.min(total, acc + speed * dt)
      const next = Math.floor(acc)
      if (next !== prev) {
        const ch = text[next - 1]
        jitter = 0.75 + Math.random() * 0.5
        if (!forced) holdUntil = now + (next === line1End || next === part2End ? HOLD_MS : (PAUSE[ch] ?? 0))
        keyClick(ch === ' ' ? 'space' : ch === '\n' ? 'enter' : 'char')
        nRef.current = next
        setN(next)
        scaleTarget.set(scaleFor(next))
      }
      if (acc < total) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce, scrollYProgress, total, text, line1End, part2End])

  // The ring pulses softly every time a word lands.
  const wordsDone = useRef(0)
  useEffect(() => {
    let k = 0
    while (k < wordEnds.length && wordEnds[k] <= n) k++
    if (k > wordsDone.current) ringRef.current?.pulse(Math.min(1.2, (k - wordsDone.current) * 0.6))
    wordsDone.current = k
  }, [n, wordEnds])

  // Ring: the loader, alone in the centre; once the story starts it floats above the text.
  const boxH = useMotionValue(0)
  useLayoutEffect(() => {
    const el = blockRef.current
    if (!el) return
    const ro = new ResizeObserver(() => boxH.set(nRef.current === 0 ? 0 : el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [boxH])
  const ringSize = n === 0 ? (mobile ? 96 : 120) : mobile ? 52 : 72
  const ringYRaw = useTransform(() => {
    const h = boxH.get()
    return h === 0 ? 0 : -(h * scale.get()) / 2 - (mobile ? 26 : 36) - ringSize / 2
  })
  const ringY = useSpring(ringYRaw, { stiffness: 80, damping: 20 })
  // Centre the ring and the text together, not just the text.
  const ringGap = mobile ? 26 : 36
  const stageY = useSpring(0, { stiffness: 80, damping: 20 })
  useEffect(() => {
    stageY.set(n === 0 ? 0 : (ringSize + ringGap) / 2)
  }, [n === 0, ringSize, ringGap, stageY]) // eslint-disable-line react-hooks/exhaustive-deps

  // Leaving: the story dims and recedes as the work section comes up.
  const exitOpacity = useTransform(scrollYProgress, [0.82, 1], [1, 0.35])
  const exitScale = useTransform(scrollYProgress, [0.82, 1], [1, 0.94])
  const exitBlur = useTransform(scrollYProgress, [0.82, 1], ['blur(0px)', 'blur(4px)'])

  const done = n >= total

  return (
    <section ref={containerRef} aria-label="Intro" className="relative h-[230svh]">
      <p className="sr-only">{STORY.map((s) => ('br' in s ? ' ' : s.t)).join('')}</p>

      {/* Invisible copies used to measure the three camera stops. */}
      <div aria-hidden className="pointer-events-none invisible fixed left-0 top-0 -z-10 w-screen">
        <p ref={ghost1} className={cn(TEXT_CLASS, 'absolute')}>{renderUnits(units, line1End, false)}</p>
        <p ref={ghost2} className={cn(TEXT_CLASS, 'absolute')}>{renderUnits(units, part2End, false)}</p>
        <p ref={ghost3} className={cn(TEXT_CLASS, 'absolute')}>{renderUnits(units, total, false)}</p>
      </div>

      <div className="sticky top-0 flex h-svh items-center justify-center overflow-hidden">
        <motion.div aria-hidden className="relative flex items-center justify-center" style={{ opacity: exitOpacity, scale: exitScale, filter: exitBlur, y: stageY }}>
          <motion.div className="absolute z-10" style={{ y: ringY }} initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.2, ease: [0.2, 0.7, 0.2, 1] }}>
            <motion.div initial={false} animate={{ width: ringSize, height: ringSize }} transition={{ type: 'spring', stiffness: 80, damping: 18 }}>
              <NeonRing ref={ringRef} size="100%" />
            </motion.div>
          </motion.div>

          <motion.div layout="position" transition={{ layout: { type: 'spring', stiffness: 90, damping: 22 } }}>
            <motion.p ref={blockRef} style={{ scale }} className={TEXT_CLASS}>
              {renderUnits(units, n, true)}
              {n > 0 && (
                <span className={cn('caret ml-[0.06em] inline-block h-[0.95em] w-[2px] translate-y-[0.14em] rounded-full bg-accent', done && 'opacity-80')} />
              )}
            </motion.p>
          </motion.div>
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
