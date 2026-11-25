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
    <section id="work" className="relative mx-auto w-full max-w-[2200px] scroll-mt-16 px-5 pb-40 pt-24 md:px-8 md:pb-56 md:pt-40 xl:px-24">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <motion.h2
          initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
          className="text-[46px] font-normal leading-none tracking-[-0.035em] text-white md:text-[64px]"
        >
          What I’ve <span className="font-semibold">built</span>
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
                    'relative h-10 rounded-full px-[18px] text-[16px] outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-accent-2/60',
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
  // Entrance: as a row comes into view its cards slide in from the left one after
  // another (left column first), like cards being dealt onto the table.
  // While on screen, the image keeps zooming slowly with the scroll.
  const ref = useRef<HTMLLIElement>(null)
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const zoom = useTransform(p, [0, 1], [1, 1.12])
  const order = index % 3
  // Driven by useInView (not whileInView) so it still plays inside AnimatePresence initial={false}.
  const inView = useInView(ref, { once: true, amount: 0.2 })

  return (
    <motion.li
      ref={ref}
      layout
      exit={{ opacity: 0, scale: 0.94, filter: 'blur(6px)', transition: { duration: 0.25 } }}
      transition={{ layout: { type: 'spring', stiffness: 260, damping: 30 } }}
    >
      <motion.div
        initial={false}
        animate={inView ? { opacity: 1, x: 0, rotate: 0, filter: 'blur(0px)' } : { opacity: 0, x: -160, rotate: -3, filter: 'blur(6px)' }}
        transition={{
          default: { type: 'spring', stiffness: 120, damping: 20, mass: 0.8, delay: order * 0.1 },
          opacity: { duration: 0.35, delay: order * 0.1 },
          filter: { duration: 0.4, delay: order * 0.1 },
        }}
        className="origin-bottom-left"
      >
        {/* Figma "ProjectCard": media on top, then a footer panel with the line, tags and company mark. */}
        <Wrapper
          {...(project.href ? { href: project.href } : {})}
          aria-label={`${project.line} — ${project.client}`}
          data-cursor="view"
          data-cursor-label={project.href ? 'View' : 'Soon'}
          className="group/card flex flex-col gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent-2/60"
        >
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-line bg-card">
            <motion.div className="size-full" style={{ scale: zoom }}>
              <CardMedia media={project.media} label={project.client} />
            </motion.div>
          </div>
          <div className="flex items-start gap-3 rounded-b-xl bg-card px-4 py-2.5">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="text-base leading-[1.4] text-white">
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
            <span title={project.client} className="grid size-6 shrink-0 place-items-center rounded-[5px] border-[0.6px] border-line bg-[#18181b] font-mono text-[8px] text-fg">
              {project.mark}
            </span>
          </div>
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
