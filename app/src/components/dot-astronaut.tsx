import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { AnimatePresence, motion, type MotionValue } from 'motion/react'

/**
 * Option D: the intro astronaut as a glowing cloud of dots, after motionsites.ai's "Dot Portrait".
 *
 * - Dots are scattered at random inside the illustrated astronaut (`astronaut-body.webp`), denser
 *   where the drawing is light; the dark line work stays mostly empty so the shape reads.
 *   Most dots are tiny, a few are bigger and sparkle.
 * - They glow: soft halos, added together (additive light), so dense areas shine.
 * - Fake depth: dots further inside the silhouette sit closer and are brighter (front-lit);
 *   the figure turns gently, so the dots slide past each other like a 3D scan.
 * - Loading: a ring of dots with a 0→100 counter and the dot count; at 100 the dots stream
 *   out of the ring and swirl into the figure.
 * - The cursor is a light: a small glowing point that lights up the dots near it ("move the light").
 * - Scrolling out of the intro, the figure rises, turns and its dots fly off to the left.
 *
 * One WebGL draw call (three.js Points + a small shader), in screen pixels.
 */

const SRC = '/images/story/astronaut-body.webp'
const IMG_W = 1304
const IMG_H = 2311
const DOT_COLOR = new THREE.Color('#eef2dc') // warm cream with a faint green, like the reference
const SPACING = 6.5 // average gap between dots, css px (they're random, so it varies)

type Props = {
  /** 0 → 1 while the intro is pinned. */
  scroll: MotionValue<number>
  /** Called when the dots start streaming into the figure (the story can start typing). */
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
/** The loading ring sits on the figure's chest, so the dots stream out from where they'll land. */
function ringCenter(l: ReturnType<typeof layout>) {
  return { x: l.left + l.w * 0.5, y: l.top + l.h * 0.27 }
}

/**
 * Scatter dots at random inside the figure. Returns source-px positions plus per-dot depth
 * (0 edge → 1 centre), brightness, size and a random seed.
 */
function sampleDots(img: HTMLImageElement, scale: number, vw: number) {
  // Pixel data at half resolution is plenty for picking spots.
  const pw = Math.floor(IMG_W / 2)
  const ph = Math.floor(IMG_H / 2)
  const cv = document.createElement('canvas')
  cv.width = pw
  cv.height = ph
  const ctx = cv.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, pw, ph)
  const px = ctx.getImageData(0, 0, pw, ph).data

  // Depth: distance to the silhouette edge on a coarse grid (two-pass chamfer).
  const G = 8 // pixels of the half-res image per grid cell
  const gw = Math.ceil(pw / G)
  const gh = Math.ceil(ph / G)
  const dist = new Float32Array(gw * gh)
  for (let y = 0; y < gh; y++)
    for (let x = 0; x < gw; x++) {
      const sx = Math.min(pw - 1, x * G + (G >> 1))
      const sy = Math.min(ph - 1, y * G + (G >> 1))
      dist[y * gw + x] = px[(sy * pw + sx) * 4 + 3] > 128 ? 1e9 : 0
    }
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= gw || y >= gh ? 0 : dist[y * gw + x])
  for (let y = 0; y < gh; y++)
    for (let x = 0; x < gw; x++) {
      const i = y * gw + x
      if (dist[i]) dist[i] = Math.min(dist[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.414, at(x + 1, y - 1) + 1.414)
    }
  let maxD = 1
  for (let y = gh - 1; y >= 0; y--)
    for (let x = gw - 1; x >= 0; x--) {
      const i = y * gw + x
      if (!dist[i]) continue
      dist[i] = Math.min(dist[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.414, at(x - 1, y + 1) + 1.414)
      maxD = Math.max(maxD, dist[i])
    }

  // How many dots: figure area on screen / spacing².
  let inside = 0
  for (let i = 3; i < px.length; i += 16) if (px[i] > 128) inside++
  const insideFrac = inside / (px.length / 16)
  const areaCss = IMG_W * IMG_H * scale * scale * insideFrac
  const target = Math.round(areaCss / ((vw >= 1024 ? SPACING : SPACING * 0.85) ** 2))

  const pos = new Float32Array(target * 2)
  const depth = new Float32Array(target)
  const lum = new Float32Array(target)
  const size = new Float32Array(target)
  const rnd = new Float32Array(target)
  let n = 0
  let tries = 0
  while (n < target && tries < target * 40) {
    tries++
    const x = Math.random() * pw
    const y = Math.random() * ph
    const k = ((y | 0) * pw + (x | 0)) * 4
    if (px[k + 3] < 128) continue
    const l = (0.2126 * px[k] + 0.7152 * px[k + 1] + 0.0722 * px[k + 2]) / 255
    if (l < 0.16 && Math.random() > 0.12) continue // line work: mostly empty
    if (Math.random() > 0.3 + 0.7 * l) continue // lighter areas get more dots
    const d = Math.sqrt(dist[Math.min(gh - 1, (y / G) | 0) * gw + Math.min(gw - 1, (x / G) | 0)] / maxD)
    pos[n * 2] = x * 2
    pos[n * 2 + 1] = y * 2
    depth[n] = d
    lum[n] = Math.min(1, 0.25 + l * 0.9)
    const big = Math.random() < 0.12
    size[n] = big ? 1.5 + Math.random() * 1.1 : 0.6 + Math.random() * 0.5
    rnd[n] = Math.random()
    n++
  }
  return {
    count: n,
    pos: pos.subarray(0, n * 2),
    depth: depth.subarray(0, n),
    lum: lum.subarray(0, n),
    size: size.subarray(0, n),
    rnd: rnd.subarray(0, n),
  }
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
  uniform vec2 uLight;
  uniform float uLightOn;
  uniform vec2 uRing;
  uniform float uRingR;
  uniform float uDot;
  attribute vec2 aPos;
  attribute float aDepth;
  attribute float aLum;
  attribute float aSize;
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
    q += vec2(sin(uTime * 1.3 + aRnd * 40.0), cos(uTime * 1.1 + aRnd * 31.0)) * 0.6;

    // Gather: every dot starts on the loading ring and swirls out to its place.
    float a = aRnd * 6.2831853 * 7.0;
    vec2 start = uRing + vec2(cos(a), sin(a)) * uRingR;
    float g = clamp(uGather * 1.7 - hash(aRnd * 7.1) * 0.7, 0.0, 1.0);
    float ge = 1.0 - pow(1.0 - g, 3.0);
    vec2 path = q - start;
    vec2 perp = vec2(-path.y, path.x);
    q = mix(start, q, ge) + perp * sin(ge * 3.14159) * 0.22;

    // Exit: the dots fly off to the left, the far ones first.
    float e = clamp(uExit * 1.35 - aRnd * 0.35, 0.0, 1.0);
    float ee = e * e;
    q.x -= ee * uView.x * (0.8 + aRnd * 0.7);
    q.y += (aRnd - 0.5) * ee * 280.0;

    // Light: front-lit by depth, twinkle on the bigger dots, and the cursor's light nearby.
    float front = 0.3 + 0.7 * pow(aDepth, 0.8);
    float tw = aSize > 1.4 ? 0.65 + 0.35 * sin(uTime * (1.5 + aRnd * 2.5) + aRnd * 60.0) : 1.0;
    float dl = length(q - uLight);
    float lit = uLightOn * exp(-(dl * dl) / (2.0 * 170.0 * 170.0));

    gl_Position = vec4(q.x / uView.x * 2.0 - 1.0, 1.0 - q.y / uView.y * 2.0, 0.0, 1.0);
    gl_PointSize = uDot * aSize * uDpr * persp * (1.0 + 0.6 * lit) * 2.6; // x2.6: room for the halo
    float visible = (g > 0.0 ? 1.0 : 0.0) * (1.0 - smoothstep(0.6, 1.0, e));
    vA = aLum * front * tw * (1.0 + 2.2 * lit) * visible * (0.55 + 0.45 * ge);
  }
`

const fragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0; // 0 centre → 1 edge
    if (d > 1.0) discard;
    float core = exp(-d * d * 22.0);
    float halo = exp(-d * d * 5.0) * 0.28;
    gl_FragColor = vec4(uColor * (core + halo) * vA, 1.0);
  }
`

export function DotAstronaut({ scroll, onReady, reduce }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const lightRef = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)
  const [loading, setLoading] = useState(!reduce)
  const [dotCount, setDotCount] = useState(0)
  const [ring, setRing] = useState({ x: 0, y: 0 })
  const [gathered, setGathered] = useState(!!reduce)
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
      uLight: { value: new THREE.Vector2(-9999, -9999) },
      uLightOn: { value: 0 },
      uRing: { value: new THREE.Vector2() },
      uRingR: { value: 46 },
      uDot: { value: 2.2 },
      uColor: { value: DOT_COLOR },
    }
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending, // overlapping dots add up: dense areas shine
    })
    let points: THREE.Points | null = null
    let img: HTMLImageElement | null = null
    let lay = layout(1, 1)

    const build = () => {
      const vw = canvas.clientWidth
      const vh = canvas.clientHeight
      lay = layout(vw, vh)
      const rc = ringCenter(lay)
      setRing(rc)
      if (!img) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      renderer.setPixelRatio(dpr)
      renderer.setSize(vw, vh, false)
      const scale = lay.h / IMG_H
      const s = sampleDots(img, scale, vw)
      setDotCount(s.count)
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(s.count * 3), 3))
      geo.setAttribute('aPos', new THREE.BufferAttribute(s.pos, 2))
      geo.setAttribute('aDepth', new THREE.BufferAttribute(s.depth, 1))
      geo.setAttribute('aLum', new THREE.BufferAttribute(s.lum, 1))
      geo.setAttribute('aSize', new THREE.BufferAttribute(s.size, 1))
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
      uniforms.uRing.value.set(rc.x, rc.y)
      uniforms.uDot.value = vw >= 1024 ? 2.2 : 1.9
    }
    build()

    // The cursor is a light: smoothed, with a small glowing point drawn where it is.
    const target = { x: 0, y: 0, on: 0, nx: 0 }
    const light = { x: -9999, y: -9999 }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const r = canvas.getBoundingClientRect()
      target.x = e.clientX - r.left
      target.y = e.clientY - r.top
      target.on = e.clientY >= r.top && e.clientY <= r.bottom ? 1 : 0
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
    let lightOn = 0
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      time += dt

      if (!reduce) {
        if (!gatherStart) {
          const p = Math.min(loaded ? 1 : 0.9, (now - t0) / 1400)
          setProgress(Math.round(p * 100))
          if (loaded && p >= 1) {
            gatherStart = now + 250
            window.setTimeout(() => setLoading(false), 450)
            window.setTimeout(() => onReadyRef.current(), 650)
            window.setTimeout(() => setGathered(true), 2400)
          }
        } else {
          uniforms.uGather.value = Math.min(1, Math.max(0, (now - gatherStart) / 2600))
        }
      }

      const s = scroll.get()
      uniforms.uShift.value = -s * lay.rise
      uniforms.uExit.value = reduce ? 0 : Math.min(1, Math.max(0, (s - 0.3) / 0.6))

      const k = 1 - Math.pow(0.002, dt)
      if (light.x < -9000 && target.on) {
        light.x = target.x
        light.y = target.y
      }
      light.x += (target.x - light.x) * k
      light.y += (target.y - light.y) * k
      const wantOn = reduce ? 0 : target.on * uniforms.uGather.value * (1 - uniforms.uExit.value)
      lightOn += (wantOn - lightOn) * k
      uniforms.uLight.value.set(light.x, light.y)
      uniforms.uLightOn.value = lightOn
      const el = lightRef.current
      if (el) {
        el.style.transform = `translate3d(${light.x}px, ${light.y}px, 0)`
        el.style.opacity = String(lightOn)
      }

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

  const RING_DOTS = 64
  const lit = Math.round((progress / 100) * RING_DOTS)
  return (
    <>
      <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 size-full" />

      {/* The light under the cursor. */}
      <div
        ref={lightRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 opacity-0"
        style={{ transform: 'translate3d(-9999px,-9999px,0)' }}
      >
        <div className="-translate-x-1/2 -translate-y-1/2">
          <div className="size-2 rounded-full bg-[#f6f8e8] shadow-[0_0_10px_3px_rgb(238_242_220/0.75),0_0_40px_14px_rgb(238_242_220/0.18)]" />
        </div>
      </div>

      {/* Loading: a ring of dots with the counter; at 100 the dots stream out of it. */}
      <AnimatePresence>
        {loading && (
          <motion.div
            key="counter"
            aria-hidden
            className="pointer-events-none absolute left-0 top-0"
            style={{ transform: `translate(${ring.x}px, ${ring.y}px)` }}
            exit={{ opacity: 0, scale: 1.15, filter: 'blur(4px)', transition: { duration: 0.6, ease: 'easeOut' } }}
          >
            <div className="relative -translate-x-1/2 -translate-y-1/2">
              <div className="relative grid size-[104px] place-items-center">
                {Array.from({ length: RING_DOTS }, (_, i) => {
                  const a = (i / RING_DOTS) * Math.PI * 2 - Math.PI / 2
                  const on = i < lit
                  return (
                    <span
                      key={i}
                      className="absolute size-[3px] rounded-full bg-[#eef2dc] transition-opacity duration-150"
                      style={{
                        left: `calc(50% + ${Math.cos(a) * 48}px - 1.5px)`,
                        top: `calc(50% + ${Math.sin(a) * 48}px - 1.5px)`,
                        opacity: on ? 1 : 0.18,
                        boxShadow: on ? '0 0 6px rgb(238 242 220 / 0.7)' : undefined,
                      }}
                    />
                  )
                })}
                <div className="flex flex-col items-center">
                  <span className="font-mono text-[15px] tabular-nums tracking-[0.06em] text-fg">{String(progress).padStart(3, '0')}</span>
                  {dotCount > 0 && (
                    <span className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.18em] text-subtle">{dotCount.toLocaleString('en-US')} dots</span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hint, like the reference: the cursor is a light. Mouse/trackpad only. */}
      <motion.p
        aria-hidden
        className="pointer-events-none absolute bottom-8 right-5 hidden font-mono text-[10px] uppercase tracking-[0.24em] text-subtle md:bottom-11 md:right-8 xl:right-24 [@media(hover:hover)_and_(pointer:fine)]:block"
        initial={{ opacity: 0 }}
        animate={{ opacity: gathered ? 1 : 0 }}
        transition={{ duration: 1 }}
      >
        Move the light
      </motion.p>
    </>
  )
}
