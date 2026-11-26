import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react'
import { CAREER, type Job } from '@/data'
import { cn } from '@/lib/utils'

export function About({ scrollRef }: { scrollRef: RefObject<HTMLDivElement | null> }) {
  return (
    <div className="pt-6 md:pt-2">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
        className="text-[46px] font-normal leading-none tracking-[-0.035em] text-white md:text-[64px]"
      >
        About <span className="font-semibold">me</span>
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
        className="mt-6 max-w-[780px] text-2xl leading-snug tracking-[-0.015em] text-white md:text-[30px]"
      >
        Product Designer with more than 8 years of experience designing digital products end to end. I excel at building and
        maintaining <span className="font-semibold">Design Systems</span> and creating meaningful experiences.
      </motion.p>
      {/* bottom room so the last job can scroll up to the reading line and light up */}
      <div className="mt-10 pb-[30vh] md:mt-14">
        <Timeline scrollRef={scrollRef} />
      </div>
    </div>
  )
}

/**
 * A straight line through each job's dot. As the panel scrolls, a small glowing point travels down it
 * (following a reading line 72% down the panel), the line fills behind it, and each dot lights up as it passes.
 */
function Timeline({ scrollRef }: { scrollRef: RefObject<HTMLDivElement | null> }) {
  const reduce = useReducedMotion()
  const listRef = useRef<HTMLOListElement>(null)
  const dotRefs = useRef<(HTMLSpanElement | null)[]>([])
  const [ys, setYs] = useState<number[]>([]) // dot centres, relative to the list
  const [h, setH] = useState(0)
  const [active, setActive] = useState(0)

  const { scrollYProgress } = useScroll({ container: scrollRef, target: listRef, offset: ['start 72%', 'end 72%'] })
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 28, restDelta: 0.0005 })

  // Offsets, not bounding rects: the items slide in with a transform, which must not shift the dots.
  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const measure = () => {
      setH(list.offsetHeight)
      setYs(dotRefs.current.map((el) => (el!.offsetParent as HTMLElement).offsetTop + el!.offsetTop + el!.offsetHeight / 2))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(list)
    return () => ro.disconnect()
  }, [])

  const first = ys[0] ?? 0
  const last = ys[ys.length - 1] ?? 0
  // Where the glowing point sits on the line, clamped between the first and last dot.
  const tip = useTransform(progress, (v) => Math.min(Math.max(v * h, first), last))
  const fillHeight = useTransform(tip, (y) => y - first)

  useMotionValueEvent(tip, 'change', (y) => {
    let idx = 0
    ys.forEach((dy, i) => {
      if (y >= dy - 1) idx = i
    })
    setActive(idx)
  })

  const on = (i: number) => reduce || i <= active

  return (
    <ol ref={listRef} className="relative pl-9 md:pl-11">
      {ys.length > 1 && (
        <div aria-hidden className="pointer-events-none absolute left-[5px] w-[2px]" style={{ top: first, height: last - first }}>
          <div className="absolute inset-0 rounded-full bg-line" />
          <motion.div
            className="absolute inset-x-0 top-0 rounded-full bg-accent/70"
            style={{ height: reduce ? last - first : fillHeight }}
          />
          {!reduce && (
            <motion.span
              className="absolute left-1/2 top-0 size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_8px_2px_var(--accent)]"
              style={{ y: fillHeight }}
            />
          )}
        </div>
      )}
      {CAREER.map((job, i) => (
        <TimelineItem
          key={job.company}
          job={job}
          index={i}
          on={on(i)}
          dotRef={(el) => {
            dotRefs.current[i] = el
          }}
        />
      ))}
    </ol>
  )
}

function TimelineItem({
  job,
  index,
  on,
  dotRef,
}: {
  job: Job
  index: number
  on: boolean
  dotRef: (el: HTMLSpanElement | null) => void
}) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: on ? 1 : 0.42, y: 0 }}
      transition={{ opacity: { duration: 0.5 }, y: { delay: 0.35 + index * 0.06, duration: 0.6, ease: [0.2, 0.7, 0.2, 1] } }}
      className="relative py-6 md:py-8"
    >
      <span
        ref={dotRef}
        aria-hidden
        className={cn(
          'absolute -left-9 top-[34px] size-3 rounded-full border-2 transition-all duration-500 md:-left-11 md:top-[42px]',
          on ? 'border-white bg-white shadow-[0_0_12px_var(--accent)]' : 'border-line bg-bg',
        )}
      />
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex items-center gap-4">
          <Logo job={job} />
          <span className="text-2xl font-semibold tracking-[-0.02em] text-white md:text-[25px]">{job.company}</span>
        </div>
        <span className="text-lg tabular-nums text-muted md:text-2xl">{job.period}</span>
      </div>
      <p className="mt-3 text-base text-white md:ml-12">
        {job.role} · {job.location}
      </p>
      {job.summary && <p className="mt-3 max-w-[560px] text-[17px] leading-relaxed text-muted md:ml-12">{job.summary}</p>}
    </motion.li>
  )
}

function Logo({ job }: { job: Job }) {
  return (
    <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-card">
      {job.mask ? (
        <span
          aria-hidden
          className="size-5 bg-fg"
          style={{ mask: `url(${job.logo}) center / contain no-repeat`, WebkitMask: `url(${job.logo}) center / contain no-repeat` }}
        />
      ) : (
        <img src={job.logo} alt="" className="size-5 object-contain" />
      )}
    </span>
  )
}
