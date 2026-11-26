import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { AnimatePresence, motion, type MotionValue } from 'motion/react'

/**
 * Option D: the intro astronaut rebuilt as a cloud of small cream dots (in the spirit of
 * motionsites.ai's "Dot Portrait").
 *
 * - The dots are sampled from the illustrated astronaut's silhouette (`astronaut-body.webp`):
 *   sparse and simple, denser along the edges, no shading; the visor is left empty (empty helmet).
 * - Depth is invented ("fake 3D"): the further a dot is from the silhouette edge, the closer it
 *   sits to the viewer. The figure turns gently, so the dots slide past each other like a 3D scan.
 * - While it loads, a 0→100 counter runs in a ring; then the dots gather into the figure.
 * - Dots drift away from the cursor and drift back.
 * - Scrolling out of the intro, the figure rises, turns and its dots fly off to the left.
 *
 * Everything runs in one WebGL draw call (three.js Points + a small shader), in screen pixels.
 */

const SRC = '/images/story/astronaut-body.webp'
const IMG_W = 1304
const IMG_H = 2311
const DOT_COLOR = new THREE.Color('#f3ecd6')

type Props = {
  /** 0 → 1 while the intro is pinned. */
  scroll: MotionValue<number>
  /** Called when the dots start gathering (the story can start typing). */
  onReady: () => void
  reduce: boolean
}

/** Where the figure sits on screen (css px), matching the illustrated astronaut it replaces. */
function layout(vw: number, vh: number) {
  if (vw >= 1024) {
    const h = vh * 1.25
    const w = (h * IMG_W) / IMG_H
    return { left: vw * 0.93 - w, top: vh * 0.14, w, h, rise: vh * 0.5 }
  }
  const h = vh * 0.66
  const w = (h * IMG_W) / IMG_H
  return { left: vw * 1.12 - w, top: vh * 0.6, w, h, rise: vh * 0.45 }
}

// The helmet's visor glass in the source image (px): an ellipse, rotated. It's left empty
// ("empty helmet"), and its rim gets bright dots, like the glasses in the reference.
const VISOR = { cx: 552, cy: 330, rx: 232, ry: 178, rot: -0.36 }
function visorF(x: number, y: number) {
  const dx = x - VISOR.cx
  const dy = y - VISOR.cy
  const c = Math.cos(-VISOR.rot)
  const s = Math.sin(-VISOR.rot)
  const u = (dx * c - dy * s) / VISOR.rx
  const v = (dx * s + dy * c) / VISOR.ry
  return u * u + v * v // < 1 inside the glass
}

/**
 * Sample the illustration into a sparse, simple dot cloud (like motionsites' "Dot Portrait"):
 * random dots inside the silhouette, denser along its edges and around the visor rim, thin
 * inside; no shading. `cellCss` is the sampling grid in css px, `spacing` the target gap
 * between dots inside the figure.
 */
function sampleDots(img: HTMLImageElement, scale: number, spacing: number) {
  const step = Math.max(2, 1.5 / scale) // grid cell in source px (~1.5 css px)
  const gw = Math.floor(IMG_W / step)
  const gh = Math.floor(IMG_H / step)
  const cv = document.createElement('canvas')
  cv.width = gw
  cv.height = gh
  const ctx = cv.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, gw, gh)
  const px = ctx.getImageData(0, 0, gw, gh).data

  // Inside = part of the figure and not the visor glass.
  const inside = new Uint8Array(gw * gh)
  for (let y = 0; y < gh; y++)
    for (let x = 0; x < gw; x++) {
      const i = y * gw + x
      inside[i] = px[i * 4 + 3] > 128 && visorF((x + 0.5) * step, (y + 0.5) * step) >= 1 ? 1 : 0
    }

  // Distance (in cells) from each inside cell to the nearest outside cell: two-pass chamfer.
  const dist = new Float32Array(gw * gh)
  for (let i = 0; i < gw * gh; i++) dist[i] = inside[i] ? 1e9 : 0
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= gw || y >= gh ? 0 : dist[y * gw + x])
  for (let y = 0; y < gh; y++)
    for (let x = 0; x < gw; x++) {
      const i = y * gw + x
      if (!dist[i]) continue
      dist[i] = Math.min(dist[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.414, at(x + 1, y - 1) + 1.414)
    }
  let maxD = 1
  for (let y = gh - 1; y >= 0; y--)
    for (let x = gw - 1; x >= 0; x--) {
      const i = y * gw + x
      if (!dist[i]) continue
      dist[i] = Math.min(dist[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.414, at(x - 1, y + 1) + 1.414)
      maxD = Math.max(maxD, dist[i])
    }

  const cellCss = step * scale
  const base = (cellCss * cellCss) / (spacing * spacing) // chance per cell for one dot per spacing²
  const pos: number[] = []
  const depth: number[] = []
  const lum: number[] = []
  const rnd: number[] = []
  for (let y = 0; y < gh; y++)
    for (let x = 0; x < gw; x++) {
      const i = y * gw + x
      if (!inside[i]) continue
      const sx = (x + Math.random()) * step
      const sy = (y + Math.random()) * step
      const edgeCss = dist[i] * cellCss
      const rim = visorF(sx, sy) < 1.22 // just outside the glass
      const l = (0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) / 255
      const line = l < 0.16 // the drawing's main line work, kept faintly so the shape reads
      let w = 0.5 + 2.4 * Math.exp(-edgeCss / 5)
      if (rim) w = 2.6
      else if (line) w += 0.35
      if (Math.random() > base * w) continue
      pos.push(sx, sy)
      depth.push(Math.sqrt(dist[i] / maxD))
      lum.push(rim ? 1 : edgeCss < 6 ? 0.8 + Math.random() * 0.2 : 0.35 + Math.random() * 0.55)
      rnd.push(Math.random())
    }
  return { pos: new Float32Array(pos), depth: new Float32Array(depth), lum: new Float32Array(lum), rnd: new Float32Array(rnd) }
}

const vertex = /* glsl */ `
  uniform vec2 uView;
  uniform float uDpr;
  uniform vec2 uOrigin;
  uniform float uScale;
  uniform vec2 uCenter;
  uniform float uDepth;
  uniform float uTime;
  uniform float uGather;
  uniform float uExit;
  uniform float uShift;
  uniform float uRot;
  uniform vec2 uMouse;
  uniform float uMouseOn;
  uniform float uDot;
  attribute vec2 aPos;
  attribute float aDepth;
  attribute float aLum;
  attribute float aRnd;
  varying float vA;

  float hash(float n) { return fract(sin(n) * 43758.5453); }

  void main() {
    vec2 p = uOrigin + aPos * uScale;
    float bob = sin(uTime * 0.55) * 10.0;
    p.y += uShift + bob;
    float z = (aDepth - 0.35) * uDepth;

    // Turn around the figure's vertical axis, with a soft perspective.
    float rot = uRot + uExit * 1.2;
    vec2 c = vec2(uCenter.x, uCenter.y + uShift + bob);
    float rx = p.x - c.x;
    float x2 = rx * cos(rot) - z * sin(rot);
    float z2 = rx * sin(rot) + z * cos(rot);
    float persp = 1600.0 / (1600.0 - z2);
    vec2 q = vec2(c.x + x2 * persp, c.y + (p.y - c.y) * persp);

    // A faint shimmer so the cloud feels alive.
    q += vec2(sin(uTime * 1.3 + aRnd * 40.0), cos(uTime * 1.1 + aRnd * 31.0)) * 0.7;

    // Dots drift away from the cursor (the cursor position is smoothed, so they drift back).
    vec2 d = q - uMouse;
    float dist = length(d);
    float push = uMouseOn * (1.0 - smoothstep(0.0, 150.0, dist));
    q += (dist > 0.001 ? d / dist : vec2(0.0)) * push * 40.0;

    // Gather: each dot flies in from a random spot on screen.
    vec2 scatter = vec2(hash(aRnd * 91.7) * uView.x, hash(aRnd * 13.3 + 5.0) * uView.y);
    float g = clamp(uGather * 1.6 - aRnd * 0.6, 0.0, 1.0);
    g = 1.0 - pow(1.0 - g, 3.0);
    q = mix(scatter, q, g);

    // Exit: the dots fly off to the left, the far ones first.
    float e = clamp(uExit * 1.35 - aRnd * 0.35, 0.0, 1.0);
    float ee = e * e;
    q.x -= ee * uView.x * (0.8 + aRnd * 0.7);
    q.y += (aRnd - 0.5) * ee * 280.0;

    gl_Position = vec4(q.x / uView.x * 2.0 - 1.0, 1.0 - q.y / uView.y * 2.0, 0.0, 1.0);
    gl_PointSize = uDot * uDpr * (0.7 + aLum * 0.6) * persp;
    vA = (0.25 + aLum * 0.75) * g * (1.0 - smoothstep(0.6, 1.0, e)) * (0.7 + 0.3 * aDepth);
  }
`

const fragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vA;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    if (r > 0.5) discard;
    gl_FragColor = vec4(uColor, vA * smoothstep(0.5, 0.25, r));
  }
`

export function DotAstronaut({ scroll, onReady, reduce }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [progress, setProgress] = useState(0)
  const [loading, setLoading] = useState(!reduce)
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let disposed = false

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' })
    renderer.setClearColor(0x000000, 0)
    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const uniforms = {
      uView: { value: new THREE.Vector2(1, 1) },
      uDpr: { value: 1 },
      uOrigin: { value: new THREE.Vector2() },
      uScale: { value: 1 },
      uCenter: { value: new THREE.Vector2() },
      uDepth: { value: 120 },
      uTime: { value: 0 },
      uGather: { value: reduce ? 1 : 0 },
      uExit: { value: 0 },
      uShift: { value: 0 },
      uRot: { value: 0 },
      uMouse: { value: new THREE.Vector2(-9999, -9999) },
      uMouseOn: { value: 0 },
      uDot: { value: 2.4 },
      uColor: { value: DOT_COLOR },
    }
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })
    let points: THREE.Points | null = null
    let img: HTMLImageElement | null = null
    let lay = layout(1, 1)

    const build = () => {
      if (!img) return
      const vw = canvas.clientWidth
      const vh = canvas.clientHeight
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      renderer.setPixelRatio(dpr)
      renderer.setSize(vw, vh, false)
      lay = layout(vw, vh)
      const scale = lay.h / IMG_H
      // Sparse: about one dot every 5.4 css px inside the figure (denser on the edges).
      const s = sampleDots(img, scale, vw >= 1024 ? 5.4 : 4.8)
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(s.rnd.length * 3), 3))
      geo.setAttribute('aPos', new THREE.BufferAttribute(s.pos, 2))
      geo.setAttribute('aDepth', new THREE.BufferAttribute(s.depth, 1))
      geo.setAttribute('aLum', new THREE.BufferAttribute(s.lum, 1))
      geo.setAttribute('aRnd', new THREE.BufferAttribute(s.rnd, 1))
      if (points) {
        points.geometry.dispose()
        points.geometry = geo
      } else {
        points = new THREE.Points(geo, material)
        points.frustumCulled = false
        scene.add(points)
      }
      uniforms.uView.value.set(vw, vh)
      uniforms.uDpr.value = dpr
      uniforms.uOrigin.value.set(lay.left, lay.top)
      uniforms.uScale.value = scale
      uniforms.uCenter.value.set(lay.left + lay.w / 2, lay.top + lay.h * 0.4)
      uniforms.uDepth.value = lay.w * 0.35
      uniforms.uDot.value = vw >= 1024 ? 2.1 : 1.8
    }

    // Pointer: smoothed, so pushed dots drift back when the cursor moves on.
    const target = { x: -9999, y: -9999, on: 0, nx: 0 }
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      target.x = e.clientX - r.left
      target.y = e.clientY - r.top
      target.on = 1
      target.nx = r.width ? target.x / r.width - 0.5 : 0
    }
    const onLeave = () => (target.on = 0)
    if (!reduce) {
      window.addEventListener('pointermove', onMove, { passive: true })
      document.addEventListener('pointerleave', onLeave)
    }

    // Loading: the counter runs at least ~1.4s, even when the image is cached.
    const t0 = performance.now()
    let loaded = false
    let gatherStart = 0
    const image = new Image()
    image.decoding = 'async'
    image.src = SRC
    image
      .decode()
      .then(() => {
        if (disposed) return
        img = image
        build()
        loaded = true
      })
      .catch(() => {})

    let raf = 0
    let running = false
    let last = performance.now()
    let time = 0
    let rot = 0
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      time += dt

      if (!reduce) {
        // Counter → gather.
        if (!gatherStart) {
          const p = Math.min(loaded ? 1 : 0.9, (now - t0) / 1400)
          setProgress(Math.round(p * 100))
          if (loaded && p >= 1) {
            gatherStart = now + 350
            setLoading(false)
            window.setTimeout(() => onReadyRef.current(), 650)
          }
        } else {
          uniforms.uGather.value = Math.min(1, Math.max(0, (now - gatherStart) / 2200))
        }
      }

      const s = scroll.get()
      uniforms.uShift.value = -s * lay.rise
      uniforms.uExit.value = reduce ? 0 : Math.min(1, Math.max(0, (s - 0.3) / 0.6))
      const m = uniforms.uMouse.value
      const k = 1 - Math.pow(0.0015, dt) // ~smooth follow
      if (target.on) {
        m.x = m.x < -9000 ? target.x : m.x + (target.x - m.x) * k
        m.y = m.y < -9000 ? target.y : m.y + (target.y - m.y) * k
      }
      uniforms.uMouseOn.value += ((reduce ? 0 : target.on) - uniforms.uMouseOn.value) * k
      rot += ((reduce ? 0 : target.nx * 0.35 + Math.sin(time * 0.25) * 0.1) - rot) * (1 - Math.pow(0.05, dt))
      uniforms.uRot.value = rot
      uniforms.uTime.value = reduce ? 0 : time

      if (points) renderer.render(scene, camera)
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
    if (reduce) {
      setLoading(false)
      onReadyRef.current()
    }
    start()

    const io = new IntersectionObserver(([e]) => (e.isIntersecting && !document.hidden ? start() : stop()))
    io.observe(canvas)
    const onVis = () => (document.hidden ? stop() : start())
    document.addEventListener('visibilitychange', onVis)

    let resizeT = 0
    const ro = new ResizeObserver(() => {
      window.clearTimeout(resizeT)
      resizeT = window.setTimeout(build, 150)
    })
    ro.observe(canvas)

    return () => {
      disposed = true
      stop()
      io.disconnect()
      ro.disconnect()
      window.clearTimeout(resizeT)
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
      document.removeEventListener('visibilitychange', onVis)
      points?.geometry.dispose()
      material.dispose()
      renderer.dispose()
    }
  }, [reduce, scroll])

  return (
    <>
      <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 size-full" />
      <AnimatePresence>
        {loading && (
          <motion.div
            key="counter"
            aria-hidden
            className="pointer-events-none absolute inset-0 grid place-items-center"
            exit={{ opacity: 0, scale: 0.92, filter: 'blur(6px)', transition: { duration: 0.5 } }}
          >
            <div className="relative grid size-24 place-items-center">
              <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90">
                <circle cx="50" cy="50" r="46" fill="none" stroke="rgb(243 236 214 / 0.14)" strokeWidth="1.5" />
                <circle
                  cx="50"
                  cy="50"
                  r="46"
                  fill="none"
                  stroke="#f3ecd6"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 46}
                  strokeDashoffset={2 * Math.PI * 46 * (1 - progress / 100)}
                />
              </svg>
              <span className="font-mono text-[13px] tabular-nums tracking-[0.08em] text-fg">{progress}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
