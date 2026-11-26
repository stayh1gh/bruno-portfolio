import { useEffect, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { DOT_BLENDING, DOT_COLOR, DOT_FRAGMENT } from './dots'

/**
 * The dots go on to build things. In the statement section (after the astronaut) a ray of sand
 * comes in from the left, like the intro's, and its dots land one after another to draw:
 *
 * - "design" (left slot): an artboard with corner handles, a circle, a rounded shape and a pen
 *   curve with its anchor points and handles;
 * - "build" (right slot; on narrow screens the only one, above the text): a browser window with a
 *   sidebar, a hero block with a button, three cards and a cursor.
 *
 * The drawing is tied to scrolling: it starts when the section enters the screen and is complete
 * a little before the section is centred; scrolling back up takes it apart again. Dots drift
 * away from the cursor, as on the astronaut.
 *
 * The slots are empty boxes laid out by CSS (see statement.tsx); this measures them and draws
 * into a canvas that covers the section. One WebGL draw call.
 */

const SP = 4.1 // gap between dots along a line, css px

type Dot = { x: number; y: number; o: number; lum: number; size: number }

/** A pen that leaves dots. `ink` counts what has been drawn so far: it is the build order. */
function createPen(rand: () => number) {
  const dots: Dot[] = []
  let ink = 0
  let ox = 0
  let oy = 0
  const put = (x: number, y: number, lum: number, jitter = 1.3) =>
    dots.push({
      x: ox + x + (rand() - 0.5) * jitter,
      y: oy + y + (rand() - 0.5) * jitter,
      o: ink,
      lum: Math.min(1, lum * (0.9 + rand() * 0.35)),
      size: rand() < 0.06 ? 1.2 + rand() * 0.6 : 0.62 + rand() * 0.4,
    })
  const line = (x0: number, y0: number, x1: number, y1: number, lum = 0.85) => {
    const len = Math.hypot(x1 - x0, y1 - y0)
    const n = Math.max(1, Math.round(len / SP))
    for (let i = 0; i <= n; i++) {
      put(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, lum)
      ink += len / n
    }
  }
  const arc = (cx: number, cy: number, r: number, a0: number, a1: number, lum = 0.85) => {
    const n = Math.max(2, Math.round((r * Math.abs(a1 - a0)) / SP))
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n
      put(cx + Math.cos(a) * r, cy + Math.sin(a) * r, lum)
      ink += (r * Math.abs(a1 - a0)) / n
    }
  }
  const P = Math.PI
  const rrect = (x: number, y: number, w: number, h: number, r: number, lum = 0.85) => {
    line(x + r, y, x + w - r, y, lum)
    arc(x + w - r, y + r, r, -P / 2, 0, lum)
    line(x + w, y + r, x + w, y + h - r, lum)
    arc(x + w - r, y + h - r, r, 0, P / 2, lum)
    line(x + w - r, y + h, x + r, y + h, lum)
    arc(x + r, y + h - r, r, P / 2, P, lum)
    line(x, y + h - r, x, y + r, lum)
    arc(x + r, y + r, r, P, P * 1.5, lum)
  }
  const fill = (x: number, y: number, w: number, h: number, spacing: number, lum: number) => {
    const n = Math.max(1, Math.round((w * h) / (spacing * spacing)))
    for (let i = 0; i < n; i++) {
      put(x + rand() * w, y + rand() * h, lum, 0)
      ink += SP * 0.35
    }
  }
  const bezier = (p: [number, number][], lum = 0.9) => {
    let px = p[0][0]
    let py = p[0][1]
    for (let i = 1; i <= 40; i++) {
      const t = i / 40
      const u = 1 - t
      const x = u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0]
      const y = u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1]
      line(px, py, x, y, lum)
      px = x
      py = y
    }
  }
  return {
    dots,
    line,
    arc,
    rrect,
    fill,
    bezier,
    circle: (cx: number, cy: number, r: number, lum = 0.85) => arc(cx, cy, r, 0, P * 2, lum),
    pause: (px: number) => (ink += px),
    moveTo: (x: number, y: number) => {
      ox = x
      oy = y
    },
    total: () => ink,
  }
}
type Pen = ReturnType<typeof createPen>

/** Design: an artboard, two shapes and a pen curve. */
function drawDesign(pen: Pen, W: number, H: number) {
  const m = 8
  pen.rrect(m, m, W - m * 2, H - m * 2, 3, 0.6)
  for (const [x, y] of [[m, m], [W - m, m], [W - m, H - m], [m, H - m]]) pen.fill(x - 4, y - 4, 8, 8, 2.3, 1)
  pen.pause(60)
  pen.circle(W * 0.27, H * 0.36, H * 0.17)
  pen.pause(40)
  pen.rrect(W * 0.52, H * 0.18, W * 0.3, H * 0.32, 12)
  pen.fill(W * 0.52 + 6, H * 0.18 + 6, W * 0.3 - 12, H * 0.32 - 12, 9, 0.28)
  pen.pause(60)
  const p: [number, number][] = [
    [W * 0.14, H * 0.8],
    [W * 0.34, H * 0.5],
    [W * 0.6, H * 0.98],
    [W * 0.86, H * 0.66],
  ]
  pen.bezier(p, 1)
  // Anchor points (squares) and their handles (a line ending in a small circle).
  pen.fill(p[0][0] - 4, p[0][1] - 4, 8, 8, 2.3, 1)
  pen.fill(p[3][0] - 4, p[3][1] - 4, 8, 8, 2.3, 1)
  pen.line(p[0][0], p[0][1], p[1][0], p[1][1], 0.5)
  pen.circle(p[1][0], p[1][1], 4.5, 0.9)
  pen.line(p[3][0], p[3][1], p[2][0], p[2][1], 0.5)
  pen.circle(p[2][0], p[2][1], 4.5, 0.9)
}

/** Build: a browser window with a small app in it. */
function drawBuild(pen: Pen, W: number, H: number) {
  const k = W / 470
  const bar = 34 * k
  pen.rrect(0, 0, W, H, 14 * k)
  pen.line(0, bar, W, bar, 0.6)
  for (let i = 0; i < 3; i++) pen.circle((16 + i * 14) * k, bar / 2, 3.4 * k, 0.9)
  pen.rrect(W * 0.3, bar * 0.26, W * 0.4, bar * 0.48, bar * 0.24, 0.5)
  pen.pause(50)
  // Sidebar
  const side = W * 0.24
  pen.line(side, bar, side, H, 0.5)
  for (let i = 0; i < 5; i++) pen.line(16 * k, bar + (26 + i * 22) * k, side - (i % 2 ? 34 : 18) * k, bar + (26 + i * 22) * k, i === 0 ? 1 : 0.5)
  pen.pause(50)
  // Hero block: two lines of text and a button
  const x = side + 18 * k
  const w = W - x - 18 * k
  const hy = bar + 18 * k
  const hh = H * 0.32
  pen.rrect(x, hy, w, hh, 8 * k, 0.75)
  pen.fill(x + 6, hy + 6, w - 12, hh - 12, 10, 0.2)
  pen.line(x + 16 * k, hy + 24 * k, x + w * 0.62, hy + 24 * k, 1)
  pen.line(x + 16 * k, hy + 40 * k, x + w * 0.42, hy + 40 * k, 0.6)
  const bw = 74 * k
  const bh = 22 * k
  const by = hy + hh - bh - 14 * k
  pen.rrect(x + 16 * k, by, bw, bh, bh / 2, 1)
  pen.fill(x + 16 * k + 5, by + 4, bw - 10, bh - 8, 3, 0.9)
  pen.pause(50)
  // Three cards
  const gap = 12 * k
  const cy = hy + hh + 16 * k
  const cw = (w - gap * 2) / 3
  const ch = H - cy - 18 * k
  for (let i = 0; i < 3; i++) {
    const cx = x + i * (cw + gap)
    pen.rrect(cx, cy, cw, ch, 6 * k, 0.7)
    pen.line(cx + 10 * k, cy + ch - 22 * k, cx + cw - 10 * k, cy + ch - 22 * k, 0.6)
    pen.line(cx + 10 * k, cy + ch - 11 * k, cx + cw * 0.55, cy + ch - 11 * k, 0.4)
    pen.pause(30)
  }
  // Cursor, about to press the button
  const ax = x + 16 * k + bw * 0.78
  const ay = by + bh * 0.55
  const s = 20 * k
  pen.line(ax, ay, ax, ay + s, 1)
  pen.line(ax, ay + s, ax + s * 0.28, ay + s * 0.74, 1)
  pen.line(ax + s * 0.28, ay + s * 0.74, ax + s * 0.7, ay + s * 0.7, 1)
  pen.line(ax + s * 0.7, ay + s * 0.7, ax, ay, 1)
  pen.fill(ax + 1, ay + s * 0.25, s * 0.3, s * 0.45, 2.6, 1)
}

function seeded(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const vertex = /* glsl */ `
  uniform vec2 uView;
  uniform float uDpr;
  uniform float uTime;
  uniform float uBuild;
  uniform float uRayY;
  uniform vec2 uMouse;
  uniform float uMouseOn;
  uniform float uDot;
  attribute vec2 aPos;
  attribute vec4 aMeta; // order, brightness, size, random
  varying float vA;

  float hash(float n) { return fract(sin(n) * 43758.5453); }

  void main() {
    float order = aMeta.x;
    float rnd = aMeta.w;
    vec2 target = aPos + vec2(sin(uTime * 1.3 + rnd * 40.0), cos(uTime * 1.1 + rnd * 31.0)) * 0.5;

    // Each dot leaves the ray when its turn comes (its order), so the lines get drawn in sequence.
    float g = clamp(uBuild * 3.4 - order * 2.4, 0.0, 1.0);
    float gx = 1.0 - pow(1.0 - g, 1.8);
    float open = smoothstep(0.45, 1.0, g);
    float flight = 1.0 - open;
    float h2 = hash(rnd * 3.7 + 1.0);
    float h3 = hash(rnd * 11.3 + 2.0);
    float h4 = hash(rnd * 5.3 + 4.0);
    vec2 q;
    q.x = mix(-40.0 - h2 * uView.x * 0.15, target.x, gx);
    float sweep = sin(q.x / uView.x * 6.0 + 1.4 - uTime * 0.3) * 46.0;
    q.y = mix(uRayY + sweep + (h2 + h3 + h4 - 1.5) * 9.0, target.y, open);

    // Hover: dots drift away from the cursor.
    vec2 md = q - uMouse;
    float mdist = length(md);
    float push = uMouseOn * open * (1.0 - smoothstep(0.0, 120.0, mdist));
    q += (mdist > 0.001 ? md / mdist : vec2(0.0)) * push * 30.0 * (0.6 + 0.8 * rnd);

    float tw = aMeta.z > 1.15 ? 0.6 + 0.4 * sin(uTime * (1.5 + rnd * 2.5) + rnd * 60.0) : 1.0;
    gl_Position = vec4(q.x / uView.x * 2.0 - 1.0, 1.0 - q.y / uView.y * 2.0, 0.0, 1.0);
    gl_PointSize = uDot * aMeta.z * uDpr * mix(1.0, 0.9, flight) * 2.6;
    vA = mix(aMeta.y, max(aMeta.y, 0.75), flight) * tw * (g > 0.0 ? 1.0 : 0.0);
  }
`

type Props = {
  /** Empty boxes laid out by CSS; a hidden one (no size) is skipped. */
  designRef: RefObject<HTMLDivElement | null>
  buildRef: RefObject<HTMLDivElement | null>
  reduce: boolean
}

export function DotBuild({ designRef, buildRef, reduce }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' })
    renderer.setClearColor(0x000000, 0)
    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const uniforms = {
      uView: { value: new THREE.Vector2(1, 1) },
      uDpr: { value: 1 },
      uTime: { value: 0 },
      uBuild: { value: reduce ? 1 : 0 },
      uRayY: { value: 0 },
      uMouse: { value: new THREE.Vector2(-9999, -9999) },
      uMouseOn: { value: 0 },
      uDot: { value: 3 },
      uColor: { value: DOT_COLOR },
    }
    const material = new THREE.ShaderMaterial({ uniforms, vertexShader: vertex, fragmentShader: DOT_FRAGMENT, ...DOT_BLENDING })
    const points = new THREE.Points(new THREE.BufferGeometry(), material)
    points.frustumCulled = false
    scene.add(points)

    const build = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (!w || !h) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      renderer.setPixelRatio(dpr)
      renderer.setSize(w, h, false)
      const origin = canvas.getBoundingClientRect()
      const pen = createPen(seeded(7))
      const slots: [HTMLDivElement | null, (pen: Pen, W: number, H: number) => void][] = [
        [designRef.current, drawDesign],
        [buildRef.current, drawBuild],
      ]
      let top = h
      for (const [el, draw] of slots) {
        if (!el || !el.offsetWidth) continue
        const r = el.getBoundingClientRect()
        pen.moveTo(r.left - origin.left, r.top - origin.top)
        draw(pen, r.width, r.height)
        pen.pause(140)
        top = Math.min(top, r.top - origin.top)
      }
      const n = pen.dots.length
      const total = pen.total() || 1
      const pos = new Float32Array(n * 2)
      const meta = new Float32Array(n * 4)
      const rand = seeded(11)
      pen.dots.forEach((d, i) => {
        pos[i * 2] = d.x
        pos[i * 2 + 1] = d.y
        meta.set([d.o / total, d.lum, d.size, rand()], i * 4)
      })
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
      geo.setAttribute('aPos', new THREE.BufferAttribute(pos, 2))
      geo.setAttribute('aMeta', new THREE.BufferAttribute(meta, 4))
      points.geometry.dispose()
      points.geometry = geo
      uniforms.uView.value.set(w, h)
      uniforms.uDpr.value = dpr
      uniforms.uDot.value = w >= 1024 ? 3 : 2.5
      // The ray comes in a little above the things it builds.
      uniforms.uRayY.value = Math.max(60, top - 70)
    }
    build()
    let buildT = 0
    const ro = new ResizeObserver(() => {
      window.clearTimeout(buildT)
      buildT = window.setTimeout(build, 150)
    })
    ro.observe(canvas)

    const pointer = { x: -9999, y: -9999, on: 0 }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const r = canvas.getBoundingClientRect()
      pointer.x = e.clientX - r.left
      pointer.y = e.clientY - r.top
      pointer.on = 1
    }
    const onLeave = () => (pointer.on = 0)
    if (!reduce) {
      window.addEventListener('pointermove', onMove, { passive: true })
      document.addEventListener('pointerleave', onLeave)
    }

    let raf = 0
    let running = false
    let last = performance.now()
    let time = 0
    let progress = reduce ? 1 : 0
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      time += dt
      // 0 when the section's top reaches the bottom of the screen → 1 a little before it is centred.
      const r = canvas.getBoundingClientRect()
      const vh = window.innerHeight
      const end = vh * 0.62 - r.height / 2
      const target = reduce ? 1 : Math.min(1, Math.max(0, (vh - r.top) / (vh - end)))
      progress += (target - progress) * (1 - Math.pow(0.004, dt))
      uniforms.uBuild.value = progress
      uniforms.uTime.value = reduce ? 0 : time
      const m = uniforms.uMouse.value
      const k = 1 - Math.pow(0.0015, dt)
      if (pointer.on) {
        m.x = m.x < -9000 ? pointer.x : m.x + (pointer.x - m.x) * k
        m.y = m.y < -9000 ? pointer.y : m.y + (pointer.y - m.y) * k
      }
      uniforms.uMouseOn.value += (pointer.on - uniforms.uMouseOn.value) * k
      renderer.render(scene, camera)
      raf = requestAnimationFrame(frame)
    }
    const start = () => {
      if (running) return
      running = true
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }
    const stop = () => {
      running = false
      cancelAnimationFrame(raf)
    }
    let visible = false
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      if (visible && !document.hidden) start()
      else stop()
    })
    io.observe(canvas)
    const onVis = () => (document.hidden || !visible ? stop() : start())
    document.addEventListener('visibilitychange', onVis)

    return () => {
      stop()
      io.disconnect()
      ro.disconnect()
      window.clearTimeout(buildT)
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
      document.removeEventListener('visibilitychange', onVis)
      points.geometry.dispose()
      material.dispose()
      renderer.dispose()
    }
  }, [reduce, designRef, buildRef])

  return <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 size-full" />
}
