import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { STORY, type StoryStyle } from '@/data'
import { cn } from '@/lib/utils'
import { keyClick } from '@/lib/typing-sound'
import { NeonRing } from './neon-ring'

// ── Flatten the story into typed units ───────────────────────────────────────────────
type Char = { ch: string; s?: StoryStyle; i: number }
type Unit = { kind: 'word'; start: number; end: number; chars: Char[] } | { kind: 'space'; i: number; s?: StoryStyle } | { kind: 'br'; i: number }

function flatten() {
  const units: Unit[] = []
  const pauseAt: Record<number, number> = {} // after `i` characters are typed, wait this long
  let text = ''
  let i = 0
  let word: Char[] | null = null
  const closeWord = () => {
    if (word && word.length) units.push({ kind: 'word', start: word[0].i, end: word[word.length - 1].i + 1, chars: word })
    word = null
  }
  for (const seg of STORY) {
    if ('pause' in seg) {
      pauseAt[i] = (pauseAt[i] ?? 0) + seg.pause
      continue
    }
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
  return { units, total: i, text, pauseAt }
}

const STYLE: Record<StoryStyle, string> = {
  b: 'font-semibold',
  s: 'font-serif italic font-normal tracking-normal text-[1.08em]',
  a: 'text-accent',
  c: 'text-accent-2',
}

// ── Pacing ───────────────────────────────────────────────────────────────────────────
// The ring loads alone, then the story is typed at an even pace. Pauses come from the
// copy itself ({ pause } in data.ts). The text is laid out at its final size and place
// from the start, so typing never moves it.
const LOADER_MS = 1600
const CPS = 18 // letters per second
const SMALL_PAUSE = { ',': 130, ' ': 28, '\n': 150 } as Record<string, number>

const TEXT_CLASS = cn(
  'text-center font-sans font-medium text-fg [text-wrap:balance]',
  'text-[30px] leading-[1.25] tracking-[-0.02em]',
  'md:text-[clamp(38px,3.8vw,68px)] md:leading-[1.22] md:tracking-[-0.03em]',
)

function renderUnits(units: Unit[], limit: number, caret: ReactNode): ReactNode[] {
  // Every letter is in the layout from the start (hidden until typed), so lines are
  // balanced and centred on the final text and nothing shifts while typing.
  const at = limit - 1 // index of the last typed character; the caret sits right after it
  const out: ReactNode[] = []
  units.forEach((u, k) => {
    if (u.kind === 'br') {
      out.push(<br key={k} />)
      if (u.i === at) out.push(<Caret key="caret" el={caret} />)
      return
    }
    if (u.kind === 'space') {
      out.push(
        <span key={k} className={u.s === 's' ? 'font-serif italic' : undefined}>
          {' '}
        </span>,
      )
      if (u.i === at) out.push(<Caret key="caret" el={caret} />)
      return
    }
    out.push(
      <span key={k} className="inline-block whitespace-nowrap">
        {u.chars.map((c) => (
          <Fragment key={c.i}>
            <span className={cn(c.i < limit ? 'char' : 'char-wait', c.s && STYLE[c.s])}>{c.ch}</span>
            {c.i === at && <Caret el={caret} />}
          </Fragment>
        ))}
      </span>,
    )
  })
  return out
}

/** Zero-width anchor so the caret never pushes letters around. */
function Caret({ el }: { el: ReactNode }) {
  return <span className="relative inline-block w-0 align-baseline">{el}</span>
}

export function Story() {
  const reduce = useReducedMotion()
  const { units, total, text, pauseAt } = useMemo(flatten, [])

  const containerRef = useRef<HTMLDivElement>(null)

  const [n, setN] = useState(0)
  const nRef = useRef(0)
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start start', 'end end'] })

  const [mobile, setMobile] = useState(false)
  useLayoutEffect(() => {
    const on = () => setMobile(window.innerWidth < 768)
    on()
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])

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
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const scrollTarget = Math.min(1, scrollYProgress.get() / 0.45) * total
      const forced = scrollTarget > acc + 0.5
      let speed = now < holdUntil ? 0 : CPS
      if (forced) speed = Math.max(speed, (scrollTarget - acc) * 5, 45)
      const prev = Math.floor(acc)
      acc = Math.min(total, acc + speed * dt)
      const next = Math.floor(acc)
      if (next !== prev) {
        const ch = text[next - 1]
        if (!forced) {
          holdUntil = now + (pauseAt[next] ?? SMALL_PAUSE[ch] ?? 0)
          acc = next // start the next letter cleanly after a pause
        }
        keyClick(ch === ' ' ? 'space' : ch === '\n' ? 'enter' : 'char')
        nRef.current = next
        setN(next)
      }
      if (acc < total) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce, scrollYProgress, total, text, pauseAt])

  // The ring is the loader: alone in the centre, then it fades away as the text appears.
  const ringSize = mobile ? 96 : 120

  // Leaving: the story dims and recedes as the work section comes up.
  const exitOpacity = useTransform(scrollYProgress, [0.6, 1], [1, 0.35])
  const exitScale = useTransform(scrollYProgress, [0.6, 1], [1, 0.94])
  const exitBlur = useTransform(scrollYProgress, [0.6, 1], ['blur(0px)', 'blur(4px)'])

  const done = n >= total

  return (
    <section ref={containerRef} aria-label="Intro" className="relative h-[150svh]">
      <p className="sr-only">{STORY.map((s) => ('br' in s ? ' ' : 't' in s ? s.t : '')).join('')}</p>

      <div className="sticky top-0 flex h-svh items-center overflow-hidden">
        {/* The loader ring sits in the middle of the screen. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
            <motion.div
              className="pointer-events-none"
              initial={{ opacity: 0, scale: 0.4 }}
              animate={n === 0 ? { opacity: 1, scale: 1, filter: 'blur(0px)' } : { opacity: [1, 1, 0], y: -ringSize * 1.6, scale: 0.6, filter: ['blur(0px)', 'blur(0px)', 'blur(8px)'] }}
              transition={n === 0 ? { duration: 1.2, ease: [0.2, 0.7, 0.2, 1] } : { duration: 0.8, ease: [0.5, 0, 0.2, 1], opacity: { duration: 0.8, times: [0, 0.45, 1] }, filter: { duration: 0.8, times: [0, 0.45, 1] } }}
              style={{ width: ringSize, height: ringSize }}
            >
              <NeonRing size="100%" />
            </motion.div>
        </div>

        {/* Same container as the navbar and work section; lines centred in it. */}
        <motion.div aria-hidden className="mx-auto w-full max-w-[1560px] origin-center px-5 md:px-8 xl:px-12" style={{ opacity: exitOpacity, scale: exitScale, filter: exitBlur }}>
          <p className={TEXT_CLASS}>{renderUnits(units, n, <span className={cn('caret absolute -top-[0.8em] left-[0.05em] h-[0.95em] w-[2px] rounded-full bg-accent', done && 'opacity-80')} />)}</p>
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
            className="block font-mono text-[11px] uppercase tracking-[0.22em] text-subtle"
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
