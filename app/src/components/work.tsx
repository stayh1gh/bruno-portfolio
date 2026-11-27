import { useEffect, useMemo, useRef } from 'react'
import { motion, motionValue, useInView, useReducedMotion, useTransform, type MotionValue } from 'motion/react'
import { PROJECTS, type Media, type Project } from '@/data'
import { Button } from './ui/button'
import { TextRoll } from './fx/text-roll'
import { ArrowSwap } from './fx/arrow-swap'
import { ChompVisual } from './chomp-visual'
import { DotProjects } from './dot-projects'

const pad = (n: number) => String(n).padStart(2, '0')

/** Screen heights of scrolling each project gets while the section is pinned. */
const PER_PROJECT = 0.9

/**
 * Featured work: a pinned stage that shows one project at a time, image on the left (near the
 * centre) and its text on the right, both floating gently as if weightless. Scrolling steps
 * through the projects; each one arrives as a ray of dots that expands into a cloud and reveals
 * it, and leaves as a cloud that closes into a ray and flies off while the next ray comes in (dot-projects.tsx runs that sequence and sets `opacities` and `float`).
 *
 * All projects are laid out on top of each other in the same two slots, so the dots can measure
 * where the image and every line of text will be.
 */
export function Work() {
  const reduce = !!useReducedMotion()
  const sectionRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const panelRefs = useRef<(HTMLDivElement | null)[]>([])
  const opacities = useMemo(() => PROJECTS.map(() => motionValue(0)), [])
  const float = useMemo(() => ({ cx: motionValue(0), cy: motionValue(0), cr: motionValue(0), tx: motionValue(0), ty: motionValue(0) }), [])

  return (
    <section id="work" ref={sectionRef} aria-label="Featured work" className="relative" style={{ height: `${(PROJECTS.length * PER_PROJECT + 1) * 100}svh` }}>
      <div ref={stageRef} className="sticky top-0 flex h-svh flex-col overflow-hidden px-5 pb-10 pt-[92px] md:px-8 md:pt-[112px] xl:px-24">
        <DotProjects sectionRef={sectionRef} stageRef={stageRef} cardRef={cardRef} panelRefs={panelRefs} opacities={opacities} float={float} perProject={PER_PROJECT} reduce={reduce} />

        <div className="flex justify-center">
          <motion.h2
            initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
            className="relative text-[44px] font-medium leading-none tracking-[-0.04em] text-white md:text-[72px]"
          >
            Featured Work
            <sup className="absolute -right-9 top-0 font-mono text-[11px] font-normal tracking-normal text-muted">({pad(PROJECTS.length)})</sup>
          </motion.h2>
        </div>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 lg:flex-row lg:gap-14">
          {/* Image slot */}
          <div ref={cardRef} className="relative aspect-[16/10] w-full max-w-[34rem] shrink-0 lg:w-[min(52vw,47.5rem,calc((100svh-21rem)*1.6))] lg:max-w-none">
            <motion.div className="size-full" style={{ x: float.cx, y: float.cy, rotate: float.cr }}>
              {PROJECTS.map((p, i) => (
                <ProjectCard key={p.slug} project={p} opacity={opacities[i]} />
              ))}
            </motion.div>
          </div>
          {/* Text slot: every panel in the same cell, so it is as tall as the tallest. */}
          <div className="w-full max-w-[34rem] lg:w-[22rem] lg:max-w-none">
            <motion.div className="grid" style={{ x: float.tx, y: float.ty }}>
              {PROJECTS.map((p, i) => (
                <ProjectInfo
                  key={p.slug}
                  project={p}
                  index={i}
                  opacity={opacities[i]}
                  panelRef={(el) => {
                    panelRefs.current[i] = el
                  }}
                />
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}

/** Only the project on show can be clicked or focused. */
function useOnShow(opacity: MotionValue<number>) {
  return useTransform(opacity, (v) => (v > 0.5 ? 'auto' : 'none'))
}

/** What the project is, a few facts in hairline rows, and a way in. */
function ProjectInfo({ project, index, opacity, panelRef }: { project: Project; index: number; opacity: MotionValue<number>; panelRef: (el: HTMLDivElement | null) => void }) {
  const pointerEvents = useOnShow(opacity)
  const rows = [
    ['Client', project.client],
    ['Focus', project.tags.join(', ')],
  ]
  return (
    <motion.div ref={panelRef} style={{ opacity, pointerEvents }} className="col-start-1 row-start-1">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-subtle">
        {pad(index + 1)} / {pad(PROJECTS.length)}
      </p>
      <h3 className="mt-3 text-[26px] font-medium leading-[1.2] tracking-[-0.025em] text-white [text-wrap:balance] lg:text-[34px]">{project.line}</h3>
      <dl className="mt-5 text-[14px] lg:mt-7">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[5rem_1fr] gap-3 border-t border-line py-2.5 last:border-b">
            <dt className="text-subtle">{k}</dt>
            <dd className="text-fg">{v}</dd>
          </div>
        ))}
      </dl>
      {project.href ? (
        <Button asChild variant="outline" size="sm" className="mt-5 lg:mt-6">
          <a href={project.href}>
            <TextRoll>View project</TextRoll>
            <ArrowSwap />
          </a>
        </Button>
      ) : (
        <p className="mt-5 text-[13px] text-subtle lg:mt-6">Case study coming soon</p>
      )}
    </motion.div>
  )
}

function ProjectCard({ project, opacity }: { project: Project; opacity: MotionValue<number> }) {
  const Wrapper = project.href ? motion.a : motion.div
  const pointerEvents = useOnShow(opacity)
  return (
    <Wrapper
      {...(project.href ? { href: project.href } : {})}
      aria-label={`${project.line} — ${project.client}`}
      data-cursor="view"
      data-cursor-label={project.href ? 'View' : 'Soon'}
      style={{ opacity, pointerEvents }}
      className="group/card absolute inset-0 block overflow-hidden rounded-xl border border-line bg-card shadow-[0_30px_80px_-20px_rgb(0_0_0/0.7)] outline-none focus-visible:ring-2 focus-visible:ring-accent-2/60"
    >
      <CardMedia media={project.media} label={project.client} />
    </Wrapper>
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
