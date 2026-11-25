import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { STORY, type StoryStyle } from '@/data'
import { cn } from '@/lib/utils'
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
  h: 'font-semibold', // highlight: weight only
  s: 'font-serif italic font-normal tracking-normal text-[1.08em]',
  a: 'text-accent',
  c: 'text-accent-2',
}

// ── Pacing ───────────────────────────────────────────────────────────────────────────
// The ring loads alone, then the story is typed at an even pace. Pauses come from the
// copy itself ({ pause } in data.ts). The text is laid out at its final size and place
// from the start, so typing never moves it.
const LOADER_MS = 1600
const CPS = 23 // letters per second
const SMALL_PAUSE = { ',': 130, ' ': 28, '\n': 150 } as Record<string, number>

const TEXT_CLASS = cn(
  // Phones: centred over the scene. Desktop: on the left, leaving the right side to the astronaut.
  'text-center lg:max-w-[54%] lg:text-left font-sans font-normal text-white [text-wrap:pretty]',
  'text-[24px] leading-[1.35] tracking-[-0.015em]',
  'md:text-[clamp(30px,2.8vw,52px)] md:leading-[1.3] md:tracking-[-0.025em]',
)

function renderUnits(units: Unit[], limit: number): ReactNode[] {
  // Every letter is in the layout from the start (hidden until typed), so lines are
  // balanced and centred on the final text and nothing shifts while typing.
  const out: ReactNode[] = []
  units.forEach((u, k) => {
    if (u.kind === 'br') {
      out.push(<br key={k} />)
      return
    }
    if (u.kind === 'space') {
      out.push(
        <span key={k} className={u.s === 's' ? 'font-serif italic' : undefined}>
          {' '}
        </span>,
      )
      return
    }
    out.push(
      <span key={k} className="inline-block whitespace-nowrap">
        {u.chars.map((c) => (
          <Fragment key={c.i}>
            <span className={cn(c.i < limit ? 'char' : 'char-wait', c.s && STYLE[c.s])}>{c.ch}</span>
          </Fragment>
        ))}
      </span>,
    )
  })
  return out
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


  return (
    <section ref={containerRef} aria-label="Intro" className="relative h-[150svh] overflow-x-clip">
      <p className="sr-only">{STORY.map((s) => ('br' in s ? ' ' : 't' in s ? s.t : '')).join('')}</p>

      {/* The astronaut, full body, floating on the right. He isn't pinned like the text:
          he scrolls with the page, so his legs come into view as you scroll down. */}
      <div aria-hidden className="pointer-events-none absolute right-[-12vw] top-[60svh] h-[66svh] lg:right-[7vw] lg:top-[14svh] lg:h-[125svh]">
        <motion.div
          className="h-full"
          initial={false}
          animate={n === 0 ? { opacity: 0, x: 80, filter: 'blur(12px)' } : { opacity: 1, x: 0, filter: 'blur(0px)' }}
          transition={{ duration: 1.6, ease: [0.2, 0.7, 0.2, 1] }}
        >
          <motion.div
            className="relative h-full max-lg:opacity-85"
            animate={reduce ? undefined : { y: [0, -14, 0], x: [0, 6, 0], rotate: [-1.5, 1.2, -1.5] }}
            transition={{
              y: { duration: 7, repeat: Infinity, ease: 'easeInOut' },
              x: { duration: 9, repeat: Infinity, ease: 'easeInOut' },
              rotate: { duration: 13, repeat: Infinity, ease: 'easeInOut' },
            }}
          >
            {/* Visor glow, breathing behind the helmet. */}
            <motion.div
              className="absolute left-[22%] top-[-1%] aspect-square w-[46%] rounded-full bg-[radial-gradient(circle,rgb(91_134_255/0.45),transparent_65%)] blur-2xl"
              animate={reduce ? undefined : { opacity: [0.5, 0.9, 0.5], scale: [0.95, 1.05, 0.95] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            />
            <img
              src="/images/story/astronaut-body.webp"
              srcSet="/images/story/astronaut-body-700.webp 700w, /images/story/astronaut-body.webp 1304w"
              sizes="(min-width: 1024px) 71svh, 37svh"
              alt=""
              width={1304}
              height={2311}
              className="relative block h-full w-auto max-w-none select-none"
              draggable={false}
            />
          </motion.div>
        </motion.div>
      </div>

      <div className="sticky top-0 flex h-svh items-center overflow-hidden">
        {/* Soft dark wash on the text side so the type stays readable. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(65%_75%_at_20%_50%,rgb(4_4_18/0.4),transparent_72%)] max-lg:bg-[radial-gradient(90%_60%_at_50%_42%,rgb(0_0_0/0.55),transparent_75%)]" />

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
        <motion.div aria-hidden className="mx-auto w-full max-w-[2200px] origin-center px-5 md:px-8 xl:px-24" style={{ opacity: exitOpacity, scale: exitScale, filter: exitBlur }}>
          <p className={TEXT_CLASS}>{renderUnits(units, n)}</p>
        </motion.div>

        <ScrollCue />
      </div>
    </section>
  )
}

/** Scroll hint: just the mouse, floating gently. */
function ScrollCue() {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 md:bottom-11"
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
    >
      <MouseIcon />
    </motion.div>
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
