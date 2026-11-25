import { useEffect, useRef } from 'react'

/**
 * Animated deep-space backdrop for the story, drawn on a canvas so it fills any screen:
 * - drifting nebula clouds in the illustration's colours (violet, electric blue, a little red-orange),
 * - soft diagonal light streaks like the ones behind the astronaut,
 * - three layers of stars that twinkle, with slight parallax on the pointer,
 * - comets that cross every few seconds.
 * Pauses when off screen or in a background tab; draws one still frame for reduced motion.
 */
type Star = { x: number; y: number; r: number; a: number; tw: number; ph: number; depth: number; hue: string; glint: boolean }
type Comet = { x: number; y: number; vx: number; vy: number; life: number; max: number; len: number; w: number }

const STAR_HUES = ['255,255,255', '214,226,255', '190,205,255', '255,214,236', '200,190,255']

// Diagonal direction of the light streaks and comets (rising to the right, like the art).
const ANGLE = -0.42

export function Galaxy({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let w = 0
    let h = 0
    let dpr = 1
    let stars: Star[] = []
    const comets: Comet[] = []
    let nextComet = 1.2
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 }

    const seedStars = () => {
      const count = Math.round((w * h) / 4200)
      stars = Array.from({ length: count }, () => {
        const depth = Math.random() < 0.7 ? 0.25 : Math.random() < 0.8 ? 0.6 : 1
        const r = depth === 1 ? 1 + Math.random() * 1.2 : depth === 0.6 ? 0.6 + Math.random() * 0.7 : 0.3 + Math.random() * 0.5
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          r,
          a: 0.35 + Math.random() * 0.65,
          tw: 0.6 + Math.random() * 2.2,
          ph: Math.random() * Math.PI * 2,
          depth,
          hue: STAR_HUES[(Math.random() * STAR_HUES.length) | 0],
          glint: depth === 1 && Math.random() < 0.35,
        }
      })
    }

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1)
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      seedStars()
    }

    const blob = (x: number, y: number, r: number, color: string, alpha: number) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, `rgba(${color},${alpha})`)
      g.addColorStop(0.45, `rgba(${color},${alpha * 0.45})`)
      g.addColorStop(1, `rgba(${color},0)`)
      ctx.fillStyle = g
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }

    const streak = (cx: number, cy: number, len: number, thick: number, color: string, alpha: number) => {
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(ANGLE)
      const g = ctx.createLinearGradient(-len / 2, 0, len / 2, 0)
      g.addColorStop(0, `rgba(${color},0)`)
      g.addColorStop(0.5, `rgba(${color},${alpha})`)
      g.addColorStop(1, `rgba(${color},0)`)
      ctx.fillStyle = g
      ctx.filter = `blur(${Math.max(6, thick * 0.6)}px)`
      ctx.fillRect(-len / 2, -thick / 2, len, thick)
      ctx.restore()
    }

    const spawnComet = () => {
      // Start off the lower-left or bottom edge and fly up-right along the streaks.
      const speed = 520 + Math.random() * 520
      const fromBottom = Math.random() < 0.55
      const x = fromBottom ? Math.random() * w * 0.8 : -40
      const y = fromBottom ? h + 40 : h * (0.25 + Math.random() * 0.75)
      const jitter = (Math.random() - 0.5) * 0.25
      const a = ANGLE + jitter
      comets.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 0, max: 1.4 + Math.random() * 1.2, len: 120 + Math.random() * 180, w: 1 + Math.random() * 1.4 })
    }

    const draw = (t: number, dt: number) => {
      pointer.x += (pointer.tx - pointer.x) * 0.04
      pointer.y += (pointer.ty - pointer.y) * 0.04

      // Base: near-black with a violet floor, matching the illustration.
      const base = ctx.createLinearGradient(0, 0, 0, h)
      base.addColorStop(0, '#02020a')
      base.addColorStop(0.6, '#07061a')
      base.addColorStop(1, '#14072a')
      ctx.filter = 'none'
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = base
      ctx.fillRect(0, 0, w, h)

      // Nebula clouds, slowly breathing and drifting.
      ctx.globalCompositeOperation = 'lighter'
      const s = Math.max(w, h)
      blob(w * (0.18 + Math.sin(t * 0.05) * 0.03), h * (0.78 + Math.cos(t * 0.04) * 0.03), s * 0.55, '88,40,200', 0.32)
      blob(w * (0.62 + Math.cos(t * 0.035) * 0.04), h * (0.3 + Math.sin(t * 0.05) * 0.04), s * 0.5, '20,40,190', 0.3)
      blob(w * (0.85 + Math.sin(t * 0.03) * 0.02), h * (0.85 + Math.cos(t * 0.045) * 0.03), s * 0.35, '138,88,243', 0.22)
      blob(w * (0.08 + Math.cos(t * 0.04) * 0.03), h * (0.35 + Math.sin(t * 0.03) * 0.04), s * 0.3, '207,38,22', 0.1 + Math.sin(t * 0.3) * 0.03)

      // Light streaks gliding along their direction.
      const glide = (k: number, speed: number) => ((t * speed + k) % 1.6) - 0.3
      for (const [k, speed, color, alpha, thick, len] of [
        [0.1, 0.018, '230,60,90', 0.22, 26, 0.9],
        [0.7, 0.012, '80,110,255', 0.28, 40, 1.1],
        [1.2, 0.022, '170,120,255', 0.18, 18, 0.7],
        [0.45, 0.015, '255,120,80', 0.12, 14, 0.6],
      ] as const) {
        const p = glide(k, speed)
        const cx = w * p
        const cy = h * (1.05 - p * 0.9) + Math.sin(t * 0.2 + k * 4) * 20
        streak(cx, cy, w * len, thick, color, alpha * (0.75 + Math.sin(t * 0.5 + k * 7) * 0.25))
      }
      ctx.filter = 'none'

      // Stars: twinkle, drift slowly left, parallax with the pointer.
      for (const st of stars) {
        st.x -= dt * 3 * st.depth
        if (st.x < -4) st.x += w + 8
        const tw = 0.55 + 0.45 * Math.sin(t * st.tw + st.ph)
        const alpha = st.a * (st.depth === 0.25 ? 0.6 + 0.4 * tw : tw)
        const x = st.x + pointer.x * 14 * st.depth
        const y = st.y + pointer.y * 10 * st.depth
        ctx.fillStyle = `rgba(${st.hue},${alpha})`
        ctx.beginPath()
        ctx.arc(x, y, st.r, 0, Math.PI * 2)
        ctx.fill()
        if (st.glint && tw > 0.6) {
          const gl = (tw - 0.6) / 0.4
          const len = st.r * 7 * gl
          ctx.strokeStyle = `rgba(${st.hue},${0.55 * gl})`
          ctx.lineWidth = 0.7
          ctx.beginPath()
          ctx.moveTo(x - len, y)
          ctx.lineTo(x + len, y)
          ctx.moveTo(x, y - len)
          ctx.lineTo(x, y + len)
          ctx.stroke()
          blob(x, y, st.r * 6, st.hue, 0.25 * gl)
        }
      }

      // Comets.
      if (!reduce) {
        nextComet -= dt
        if (nextComet <= 0) {
          spawnComet()
          nextComet = 2.2 + Math.random() * 3.8
        }
      }
      for (let i = comets.length - 1; i >= 0; i--) {
        const c = comets[i]
        c.life += dt
        c.x += c.vx * dt
        c.y += c.vy * dt
        const k = c.life / c.max
        const fade = k < 0.15 ? k / 0.15 : k > 0.75 ? Math.max(0, (1 - k) / 0.25) : 1
        if (k >= 1 || c.x > w + 300 || c.y < -300) {
          comets.splice(i, 1)
          continue
        }
        const sp = Math.hypot(c.vx, c.vy)
        const tx = c.x - (c.vx / sp) * c.len
        const ty = c.y - (c.vy / sp) * c.len
        const g = ctx.createLinearGradient(tx, ty, c.x, c.y)
        g.addColorStop(0, 'rgba(140,160,255,0)')
        g.addColorStop(0.7, `rgba(190,205,255,${0.35 * fade})`)
        g.addColorStop(1, `rgba(255,255,255,${0.95 * fade})`)
        ctx.strokeStyle = g
        ctx.lineWidth = c.w
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(tx, ty)
        ctx.lineTo(c.x, c.y)
        ctx.stroke()
        blob(c.x, c.y, 10 + c.w * 4, '200,215,255', 0.5 * fade)
      }
      ctx.globalCompositeOperation = 'source-over'
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const onMove = (e: PointerEvent) => {
      pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2
      pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener('pointermove', onMove, { passive: true })

    let raf = 0
    let running = false
    let last = performance.now()
    let t = Math.random() * 100
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      t += dt
      draw(t, dt)
      raf = requestAnimationFrame(loop)
    }
    const start = () => {
      if (running || reduce) return
      running = true
      last = performance.now()
      raf = requestAnimationFrame(loop)
    }
    const stop = () => {
      running = false
      cancelAnimationFrame(raf)
    }

    if (reduce) draw(t, 0)
    const io = new IntersectionObserver(([e]) => (e.isIntersecting && !document.hidden ? start() : stop()))
    io.observe(canvas)
    const onVis = () => (document.hidden ? stop() : start())
    document.addEventListener('visibilitychange', onVis)

    return () => {
      stop()
      io.disconnect()
      ro.disconnect()
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  return <canvas ref={ref} aria-hidden className={className} />
}
