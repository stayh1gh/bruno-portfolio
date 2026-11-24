import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, LayoutGroup, motion, useInView } from 'motion/react'
import { FILTERS, PROJECTS, type Media, type Project } from '@/data'
import { cn } from '@/lib/utils'
import { Badge } from './ui/badge'
import { ArrowSwap } from './fx/arrow-swap'
import { ChompVisual } from './chomp-visual'

type Filter = (typeof FILTERS)[number]

export function Work() {
  const [filter, setFilter] = useState<Filter>('All')
  const list = PROJECTS.filter((p) => filter === 'All' || p.tags.includes(filter))

  return (
    <section id="work" className="relative mx-auto w-full max-w-[1248px] scroll-mt-16 px-5 pb-28 pt-10 md:px-8 md:pb-36 xl:px-0">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <motion.h2
          initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
          className="text-[40px] font-medium leading-none tracking-[-0.035em] md:text-[56px]"
        >
          What I’ve <span className="font-serif italic font-normal tracking-normal text-accent-2">built</span>
        </motion.h2>
        <LayoutGroup id="filters">
          <div role="tablist" aria-label="Filter projects" className="-mx-1 flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const on = f === filter
              return (
                <button
                  key={f}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'relative h-8 rounded-full px-3.5 text-[13px] outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-accent-2/60',
                    on ? 'text-bg' : 'text-muted hover:text-fg',
                  )}
                >
                  {on && (
                    <motion.span
                      layoutId="filter-pill"
                      className="absolute inset-0 rounded-full bg-fg"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  {!on && <span className="absolute inset-0 rounded-full border border-line transition-colors duration-300 hover:border-fg/25" />}
                  <span className="relative">{f}</span>
                </button>
              )
            })}
          </div>
        </LayoutGroup>
      </div>

      <motion.ul layout className="mt-12 grid gap-x-5 gap-y-6 sm:grid-cols-2 md:mt-16 lg:grid-cols-3">
        <AnimatePresence mode="popLayout" initial={false}>
          {list.map((p, i) => (
            <ProjectCard key={p.slug} project={p} index={i} />
          ))}
        </AnimatePresence>
      </motion.ul>
    </section>
  )
}

function ProjectCard({ project, index }: { project: Project; index: number }) {
  const Wrapper = project.href ? 'a' : 'div'
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 40, filter: 'blur(10px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, scale: 0.94, filter: 'blur(6px)', transition: { duration: 0.25 } }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{
        layout: { type: 'spring', stiffness: 260, damping: 30 },
        default: { duration: 0.8, delay: (index % 3) * 0.09, ease: [0.2, 0.7, 0.2, 1] },
      }}
    >
      <Wrapper
        {...(project.href ? { href: project.href } : {})}
        className="group/card group/roll block rounded-[20px] border border-line bg-card p-2 outline-none transition-[border-color,transform] duration-500 hover:-translate-y-1 hover:border-fg/15 focus-visible:ring-2 focus-visible:ring-accent-2/60"
      >
        <div className="relative aspect-[4/3] overflow-hidden rounded-[14px] bg-bg">
          <CardMedia media={project.media} label={project.client} />
          <div className="pointer-events-none absolute inset-0 rounded-[14px] ring-1 ring-inset ring-white/5" />
        </div>
        <div className="flex items-start justify-between gap-4 px-2 pb-2 pt-4">
          <div>
            <p className="text-[15px] font-medium leading-snug tracking-[-0.01em] text-fg">{project.line}</p>
            <p className="mt-1 text-[13px] text-subtle">{project.client}</p>
          </div>
          {project.href && (
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-line text-muted transition-colors duration-300 group-hover/card:border-accent-2/40 group-hover/card:bg-accent-2/10 group-hover/card:text-accent-2">
              <ArrowSwap />
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 px-2 pb-2 pt-1">
          {project.tags.map((t) => (
            <Badge key={t}>{t}</Badge>
          ))}
        </div>
      </Wrapper>
    </motion.li>
  )
}

function CardMedia({ media, label }: { media: Media; label: string }) {
  if (media.kind === 'chomp') return <ChompVisual />
  if (media.kind === 'video') return <LoopVideo media={media} label={label} />
  return (
    <img
      src={media.src}
      alt={`${label} screens`}
      loading="lazy"
      className="size-full object-cover transition-[transform] duration-[1.4s] ease-[cubic-bezier(.2,.7,.2,1)] group-hover/card:scale-[1.06]"
      style={{ objectPosition: media.position ?? 'center', background: media.bg }}
    />
  )
}

/** Plays while on screen, pauses off screen. */
function LoopVideo({ media, label }: { media: Extract<Media, { kind: 'video' }>; label: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const inView = useInView(ref, { margin: '-10%' })
  useEffect(() => {
    const v = ref.current
    if (!v) return
    if (inView && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) v.play().catch(() => {})
    else v.pause()
  }, [inView])
  return (
    <video
      ref={ref}
      muted
      loop
      playsInline
      preload="metadata"
      poster={media.poster}
      aria-label={`${label} walkthrough`}
      className="size-full object-cover transition-transform duration-[1.4s] ease-[cubic-bezier(.2,.7,.2,1)] group-hover/card:scale-[1.04]"
    >
      <source src={media.webm} type="video/webm" />
      <source src={media.mp4} type="video/mp4" />
    </video>
  )
}
