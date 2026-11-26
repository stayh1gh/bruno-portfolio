import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useInView, useScroll, useTransform } from 'motion/react'
import { PROJECTS, type Media, type Project } from '@/data'
import { Button } from './ui/button'
import { TextRoll } from './fx/text-roll'
import { ArrowSwap } from './fx/arrow-swap'
import { ChompVisual } from './chomp-visual'

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Featured work, after shaahid.in (layout) and thiagovitamina.com (the hairline detail rows):
 * a centred title, the projects as one column of large images on the right, and on the left a
 * panel that stays put and describes whichever project is in the middle of the screen.
 * On wide screens the title stays pinned in the navbar row while the projects scroll under it.
 * Below `lg` there is no side panel: each image carries its own caption.
 */
export function Work() {
  const [active, setActive] = useState(0)

  return (
    <section id="work" className="relative mx-auto w-full max-w-[2200px] scroll-mt-16 px-5 pb-40 pt-24 md:px-8 md:pb-56 md:pt-40 xl:px-24">
      <div className="pointer-events-none z-40 flex justify-center min-[1440px]:sticky min-[1440px]:top-[20px] min-[1440px]:mix-blend-difference">
        <motion.h2
          initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
          className="relative text-[40px] font-medium leading-none tracking-[-0.035em] text-white md:text-[44px]"
        >
          Featured Work
          <sup className="absolute -right-9 top-0 font-mono text-[11px] font-normal tracking-normal text-muted">({pad(PROJECTS.length)})</sup>
        </motion.h2>
      </div>

      <div className="mx-auto mt-14 grid max-w-[1320px] gap-x-16 md:mt-28 lg:grid-cols-[minmax(0,21rem)_minmax(0,46rem)] lg:justify-between">
        <aside className="hidden lg:block">
          <div className="sticky top-[max(7rem,calc(50svh-9rem))]">
            <AnimatePresence mode="wait" initial={false}>
              <ProjectInfo key={PROJECTS[active].slug} project={PROJECTS[active]} index={active} />
            </AnimatePresence>
          </div>
        </aside>
        <ul className="flex flex-col gap-16 lg:gap-28">
          {PROJECTS.map((p, i) => (
            <ProjectCard key={p.slug} project={p} onActive={() => setActive(i)} />
          ))}
        </ul>
      </div>
    </section>
  )
}

/** The side panel: what the project is, a few facts in hairline rows, and a way in. */
function ProjectInfo({ project, index }: { project: Project; index: number }) {
  const rows = [
    ['Client', project.client],
    ['Focus', project.tags.join(', ')],
  ]
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
      transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-subtle">
        {pad(index + 1)} / {pad(PROJECTS.length)}
      </p>
      <h3 className="mt-3 text-[24px] font-medium leading-[1.25] tracking-[-0.02em] text-white [text-wrap:balance]">{project.line}</h3>
      <dl className="mt-6 text-[14px]">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[5rem_1fr] gap-3 border-t border-line py-2.5 last:border-b">
            <dt className="text-subtle">{k}</dt>
            <dd className="text-fg">{v}</dd>
          </div>
        ))}
      </dl>
      {project.href ? (
        <Button asChild variant="outline" size="sm" className="mt-6">
          <a href={project.href}>
            <TextRoll>View project</TextRoll>
            <ArrowSwap />
          </a>
        </Button>
      ) : (
        <p className="mt-6 text-[13px] text-subtle">Case study coming soon</p>
      )}
    </motion.div>
  )
}

function ProjectCard({ project, onActive }: { project: Project; onActive: () => void }) {
  const Wrapper = project.href ? 'a' : 'div'
  const ref = useRef<HTMLLIElement>(null)
  // While on screen, the image keeps zooming slowly with the scroll.
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const zoom = useTransform(p, [0, 1], [1, 1.1])
  const inView = useInView(ref, { once: true, amount: 0.15 })
  // The card crossing the middle of the screen is the one the side panel describes.
  const centred = useInView(ref, { margin: '-50% 0px -50% 0px' })
  const onActiveRef = useRef(onActive)
  useEffect(() => {
    onActiveRef.current = onActive
  })
  useEffect(() => {
    if (centred) onActiveRef.current()
  }, [centred])

  return (
    <motion.li
      ref={ref}
      initial={false}
      animate={inView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: 40, filter: 'blur(8px)' }}
      transition={{ duration: 0.8, ease: [0.2, 0.7, 0.2, 1] }}
    >
      <Wrapper
        {...(project.href ? { href: project.href } : {})}
        aria-label={`${project.line} — ${project.client}`}
        data-cursor="view"
        data-cursor-label={project.href ? 'View' : 'Soon'}
        className="group/card block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent-2/60"
      >
        <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-line bg-card">
          <motion.div className="size-full" style={{ scale: zoom }}>
            <CardMedia media={project.media} label={project.client} />
          </motion.div>
        </div>
        {/* Caption: only where there is no side panel. */}
        <div className="mt-4 lg:hidden">
          <p className="text-[19px] font-medium leading-snug tracking-[-0.015em] text-white">{project.line}</p>
          <p className="mt-1.5 text-[14px] text-muted">
            {project.client} · {project.tags.join(', ')}
          </p>
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
