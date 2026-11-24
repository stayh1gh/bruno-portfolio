import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, LayoutGroup, motion, useInView, useScroll, useTransform } from 'motion/react'
import { FILTERS, PROJECTS, type Media, type Project } from '@/data'
import { cn } from '@/lib/utils'
import { Badge } from './ui/badge'
import { ChompVisual } from './chomp-visual'

type Filter = (typeof FILTERS)[number]

export function Work() {
  const [filter, setFilter] = useState<Filter>('All')
  const list = PROJECTS.filter((p) => filter === 'All' || p.tags.includes(filter))

  return (
    <section id="work" className="relative mx-auto w-full max-w-[1560px] scroll-mt-16 px-5 pb-40 pt-24 md:px-8 md:pb-56 md:pt-40 xl:px-12">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <motion.h2
          initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
          className="text-[46px] font-medium leading-none tracking-[-0.035em] md:text-[64px]"
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
                    'relative h-8 rounded-full px-3.5 text-[15px] outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-accent-2/60',
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

      <motion.ul layout className="mt-14 grid gap-x-6 gap-y-10 sm:grid-cols-2 md:mt-20 md:gap-y-12 lg:grid-cols-3">
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
  // Scroll-linked, like kenjilambert.com: the card grows from 88% as it comes up, its
  // image keeps zooming slowly while it passes, and the text rises in a beat later.
  const ref = useRef<HTMLLIElement>(null)
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const lag = (index % 3) * 0.03 // columns arrive one after another
  const scale = useTransform(p, [0, 0.4 + lag], [0.88, 1])
  const opacity = useTransform(p, [0, 0.22 + lag], [0, 1])
  const zoom = useTransform(p, [0, 1], [1, 1.12])
  const textY = useTransform(p, [0.1 + lag, 0.42 + lag], [26, 0])
  const textOpacity = useTransform(p, [0.1 + lag, 0.42 + lag], [0, 1])

  return (
    <motion.li
      ref={ref}
      layout
      exit={{ opacity: 0, scale: 0.94, filter: 'blur(6px)', transition: { duration: 0.25 } }}
      transition={{ layout: { type: 'spring', stiffness: 260, damping: 30 } }}
    >
      <motion.div style={{ scale, opacity }} className="origin-bottom">
        {/* Figma "ProjectCard": media on top, then a footer panel with the line, tags and company mark. */}
        <Wrapper
          {...(project.href ? { href: project.href } : {})}
          aria-label={`${project.line} — ${project.client}`}
          className="group/card flex flex-col rounded-xl bg-card outline-none focus-visible:ring-2 focus-visible:ring-accent-2/60"
        >
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-line bg-card">
            <motion.div className="size-full" style={{ scale: zoom }}>
              <CardMedia media={project.media} label={project.client} />
            </motion.div>
          </div>
          <motion.div style={{ y: textY, opacity: textOpacity }} className="flex items-start gap-3 px-4 pb-4 pt-3.5">
            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              <p className="text-[17px] leading-[1.4] tracking-[-0.01em] text-fg">
                <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-[position:0_100%] bg-no-repeat transition-[background-size] duration-500 ease-[cubic-bezier(.2,.7,.2,1)] group-hover/card:bg-[length:100%_1px]">
                  {project.line}
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                {project.tags.map((t) => (
                  <Badge key={t}>{t}</Badge>
                ))}
              </div>
            </div>
            <span title={project.client} className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md border border-line bg-bg font-mono text-[10px] text-fg">
              {project.mark}
            </span>
          </motion.div>
        </Wrapper>
      </motion.div>
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
      className="size-full object-cover transition-[transform] duration-[1.4s] ease-[cubic-bezier(.2,.7,.2,1)] group-hover/card:scale-[1.03]"
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
      className="size-full object-cover transition-transform duration-[1.4s] ease-[cubic-bezier(.2,.7,.2,1)] group-hover/card:scale-[1.03]"
    >
      <source src={media.webm} type="video/webm" />
      <source src={media.mp4} type="video/mp4" />
    </video>
  )
}
