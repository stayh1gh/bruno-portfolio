import { useEffect, useId, useImperativeHandle, useRef, type CSSProperties, type Ref } from 'react'
import { useReducedMotion } from 'motion/react'

export type RingHandle = {
  /** Kick the ring: it swells and wobbles harder, then settles. */
  pulse: (strength?: number) => void
}

const POINTS = 168
const R = 62

/** Shortest signed distance between two angles. */
function angleDelta(a: number, b: number) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b))
}

/**
 * A neon ring drawn in code: a closed path whose radius is a sum of slow sine waves plus a
 * travelling "wobble" on one side, stroked in layers of blurred blue to make the glow.
 */
function ringPath(t: number, energy: number, inner: boolean) {
  const breathe = 1 + 0.022 * Math.sin(t * 1.25) + energy * 0.06
  const base = (inner ? R * 0.93 : R) * breathe
  const wobbleAt = 2.35 + 0.35 * Math.sin(t * 0.37) + (inner ? 0.18 : 0)
  const wobbleAmp = 0.05 + energy * 0.1
  let d = ''
  for (let i = 0; i <= POINTS; i++) {
    const th = (i / POINTS) * Math.PI * 2
    const near = Math.exp(-((angleDelta(th, wobbleAt) / 0.62) ** 2))
    const k =
      1 +
      0.016 * Math.sin(3 * th + t * 0.8 + (inner ? 1.4 : 0)) +
      0.011 * Math.sin(5 * th - t * 1.15 + 1) +
      (0.006 + energy * 0.02) * Math.sin(8 * th + t * 2.1) +
      near * wobbleAmp * Math.sin(9 * th - t * 2.6)
    const r = base * k
    const x = Math.cos(th) * r
    const y = Math.sin(th) * r
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`
  }
  return d + 'Z'
}

type Props = {
  size: number | string
  className?: string
  style?: CSSProperties
  ref?: Ref<RingHandle>
}

export function NeonRing({ size, className, style, ref }: Props) {
  const reduce = useReducedMotion()
  const id = useId().replace(/:/g, '')
  const outer = useRef<SVGGElement>(null)
  const inner = useRef<SVGGElement>(null)
  const energy = useRef(0)
  const glow = useRef<SVGGElement>(null)

  useImperativeHandle(ref, () => ({
    pulse: (s = 1) => {
      energy.current = Math.min(1.4, energy.current + 0.45 * s)
    },
  }))

  useEffect(() => {
    const draw = (t: number) => {
      const e = energy.current
      const dOuter = ringPath(t, e, false)
      const dInner = ringPath(t, e, true)
      outer.current?.querySelectorAll('path').forEach((p) => p.setAttribute('d', dOuter))
      inner.current?.querySelectorAll('path').forEach((p) => p.setAttribute('d', dInner))
      glow.current?.setAttribute('opacity', String(0.75 + Math.min(0.25, e * 0.3)))
    }
    if (reduce) {
      draw(1.2)
      return
    }
    let raf = 0
    let last = performance.now()
    let t = Math.random() * 10
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      t += dt * (1 + energy.current * 1.6)
      energy.current *= Math.exp(-dt * 2.6)
      draw(t)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [reduce])

  return (
    <svg
      aria-hidden
      viewBox="-100 -100 200 200"
      className={className}
      style={{ width: size, height: size, overflow: 'visible', ...style }}
    >
      <defs>
        <filter id={`${id}-lg`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <filter id={`${id}-md`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.2" />
        </filter>
        <radialGradient id={`${id}-fill`}>
          <stop offset="0.55" stopColor="var(--ring-glow)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--ring-glow)" stopOpacity="0.16" />
        </radialGradient>
      </defs>
      <circle r={R * 1.05} fill={`url(#${id}-fill)`} />
      <g ref={glow} fill="none" strokeLinejoin="round">
        <g ref={inner}>
          <path stroke="var(--ring-glow)" strokeWidth="12" opacity="0.7" filter={`url(#${id}-md)`} />
        </g>
        <g ref={outer}>
          <path stroke="var(--ring-glow)" strokeWidth="18" opacity="0.65" filter={`url(#${id}-lg)`} />
          <path stroke="var(--ring-mid)" strokeWidth="9" opacity="0.95" filter={`url(#${id}-md)`} />
          <path stroke="var(--ring-core)" strokeWidth="4.6" />
          <path stroke="#ffffff" strokeWidth="1.3" opacity="0.45" />
        </g>
      </g>
    </svg>
  )
}
