import { useRef, useState, type RefObject } from 'react'
import { motion, useMotionValueEvent, useScroll, useSpring } from 'motion/react'
import { CAREER, type Job } from '@/data'
import { cn } from '@/lib/utils'

export function About({ scrollRef }: { scrollRef: RefObject<HTMLDivElement | null> }) {
  return (
    <div className="pt-6 md:pt-2">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
        className="text-[40px] font-medium leading-none tracking-[-0.035em] md:text-[56px]"
      >
        About <span className="font-serif italic font-normal tracking-normal text-accent-2">me</span>
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
        className="mt-6 max-w-[780px] text-xl leading-snug tracking-[-0.015em] text-fg/90 md:text-[26px]"
      >
        Product Designer with more than 8 years of experience designing digital products end to end. I excel at building and
        maintaining <span className="font-serif italic text-accent">Design Systems</span> and creating meaningful experiences.
      </motion.p>
      <motion.h3
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-16 font-mono text-[11px] uppercase tracking-[0.22em] text-subtle md:mt-20"
      >
        Work experience
      </motion.h3>
      <Timeline scrollRef={scrollRef} />
    </div>
  )
}

function Timeline({ scrollRef }: { scrollRef: RefObject<HTMLDivElement | null> }) {
  const listRef = useRef<HTMLOListElement>(null)
  const { scrollYProgress } = useScroll({ container: scrollRef, target: listRef, offset: ['start 75%', 'end 75%'] })
  const fill = useSpring(scrollYProgress, { stiffness: 140, damping: 28 })
  const [active, setActive] = useState(0)
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    setActive(Math.min(CAREER.length - 1, Math.floor(v * CAREER.length + 0.15)))
  })

  return (
    <ol ref={listRef} className="relative mt-8 pl-9 md:pl-11">
      <div className="absolute bottom-3 left-[5px] top-3 w-[2px] overflow-hidden rounded-full bg-line">
        <motion.div className="h-full w-full origin-top rounded-full bg-accent shadow-[0_0_12px_var(--accent)]" style={{ scaleY: fill }} />
      </div>
      {CAREER.map((job, i) => (
        <TimelineItem key={job.company} job={job} index={i} on={i <= active} current={i === active} />
      ))}
    </ol>
  )
}

function TimelineItem({ job, index, on, current }: { job: Job; index: number; on: boolean; current: boolean }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: on ? 1 : 0.42, y: 0 }}
      transition={{ opacity: { duration: 0.5 }, y: { delay: 0.35 + index * 0.06, duration: 0.6, ease: [0.2, 0.7, 0.2, 1] } }}
      className="relative py-6 md:py-8"
    >
      <span
        aria-hidden
        className={cn(
          'absolute -left-9 top-[34px] size-3 rounded-full border-2 transition-all duration-500 md:-left-11 md:top-[42px]',
          on ? 'border-accent bg-accent' : 'border-line bg-bg',
          current && 'shadow-[0_0_0_5px_color-mix(in_oklab,var(--accent)_22%,transparent),0_0_18px_var(--accent)]',
        )}
      />
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex items-center gap-4">
          <Logo job={job} />
          <span className="text-xl font-medium tracking-[-0.02em] md:text-[22px]">{job.company}</span>
        </div>
        <span className="text-base tabular-nums text-muted md:text-xl">{job.period}</span>
      </div>
      <p className="mt-3 text-sm text-fg md:ml-12">
        {job.role} · {job.location}
      </p>
      {job.summary && <p className="mt-3 max-w-[560px] text-[15px] leading-relaxed text-muted md:ml-12">{job.summary}</p>}
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
