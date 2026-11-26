import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { MotionValue } from 'motion/react'

/**
 * Option D: the intro astronaut as a glowing cloud of dots, after motionsites.ai's "Dot Portrait".
 *
 * - Intro: the dots blow in from off-screen left as one ray of sand, flying together and
 *   undulating like a slow wave, then the ray opens up into the astronaut.
 * - Dots are scattered at random inside the illustrated astronaut (`astronaut-body.webp`). Most of
 *   them sit on the drawing's contours (line work, shadow edges, the silhouette), which read as
 *   bright dotted lines, as in the reference; a dim fill lies between them, denser on the helmet.
 *   Most dots are tiny, a few are bigger and sparkle.
 * - The visor is dark glass: the face in the drawing is masked out (`VISOR`), leaving a bright rim,
 *   a few dim dots and one soft reflection.
 * - Gloomy, low-key light, baked per dot: lit from the upper left, right and under sides in
 *   shadow, legs sinking into the dark; a slow shadow drifts across the figure.
 * - They glow: soft halos added together (additive light), so dense areas shine.
 * - Fake depth: dots further inside the silhouette sit closer; the figure turns gently toward the
 *   cursor, so the dots slide past each other like a 3D scan.
 * - Scrolling out of the intro, the figure rises, turns and its dots fly off to the left.
 *
 * One WebGL draw call (three.js Points + a small shader), in screen pixels.
 */

const SRC = '/images/story/astronaut-body.webp'
const IMG_W = 1304
const IMG_H = 2311
const DOT_COLOR = new THREE.Color('#e6ebd8') // pale cream with a faint green, like the reference
const SPACING = 4.9 // average gap between dots, css px (it varies: denser on contours and the helmet)

type Props = {
  /** 0 → 1 while the intro is pinned. */
  scroll: MotionValue<number>
  /** Called shortly after the dots start blowing in (the story can start typing). */
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
/**
 * Where the drawing deserves more dots (source px). Gaussian "spots" add to a base density:
 * the helmet most of all, then the hands and the chest panel; the legs get fewer.
 */
const SPOTS = [
  { x: 560, y: 370, r: 290, w: 1.7 }, // helmet
  { x: 600, y: 760, r: 170, w: 0.6 }, // chest panel
  { x: 90, y: 1110, r: 130, w: 0.6 }, // left glove
  { x: 1140, y: 1170, r: 130, w: 0.6 }, // right glove
]
function detailWeight(x: number, y: number) {
  let w = y > 1450 ? 0.5 : 0.75 // legs sparser
  for (const s of SPOTS) {
    const dx = x - s.x
    const dy = y - s.y
    w += s.w * Math.exp(-(dx * dx + dy * dy) / (2 * s.r * s.r))
  }
  return w
}
const FILL = 0.55 // how much of the weight goes to the dim fill between contours
const EDGE = 2.1 // ...and to the contour lines
const MAX_WEIGHT = 3.6

/**
 * The visor glass, outlined in source px. The drawing has a face in there; everything inside this
 * outline is ignored and replaced by dark glass: a bright rim, a few dim dots and one soft reflection.
 */
const VISOR: [number, number][] = [
  [338, 214], [352, 188], [385, 168], [430, 158], [500, 156], [580, 162], [650, 178], [705, 200],
  [733, 228], [741, 270], [738, 320], [728, 352], [690, 370], [640, 392], [600, 418], [570, 440],
  [520, 452], [470, 456], [430, 448], [405, 430], [385, 400], [362, 350], [345, 290], [337, 245],
]
const VISOR_BOX = { x0: 315, y0: 135, x1: 765, y1: 480 }
const VISOR_C = { x: 540, y: 305 }
const RIM = 6 // half-width of the visor's rim line, source px
/** Signed distance to the visor outline: > 0 inside the glass. */
function visorDistance(x: number, y: number) {
  let inside = false
  let best = 1e9
  for (let i = 0, j = VISOR.length - 1; i < VISOR.length; j = i++) {
    const [ax, ay] = VISOR[j]
    const [bx, by] = VISOR[i]
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside
    const ex = bx - ax
    const ey = by - ay
    const t = Math.min(1, Math.max(0, ((x - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey)))
    best = Math.min(best, Math.hypot(x - ax - ex * t, y - ay - ey * t))
  }
  return inside ? best : -best
}
const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
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

  // Luminance of the drawing (0 outside the figure), with the face behind the visor painted over.
  const lumMap = new Float32Array(pw * ph)
  for (let i = 0; i < pw * ph; i++)
    lumMap[i] = px[i * 4 + 3] > 128 ? (0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) / 255 : 0
  const visor = new Float32Array(pw * ph).fill(-1e3) // signed distance to the visor outline, near it
  for (let y = VISOR_BOX.y0 >> 1; y < VISOR_BOX.y1 >> 1; y++)
    for (let x = VISOR_BOX.x0 >> 1; x < VISOR_BOX.x1 >> 1; x++) {
      const sd = visorDistance(x * 2 + 1, y * 2 + 1)
      visor[y * pw + x] = sd
      if (sd > -RIM) lumMap[y * pw + x] = 0.5
    }

  // Contours: where the drawing changes (its line work, the edges of shadows, the silhouette).
  const edgeMap = new Float32Array(pw * ph)
  for (let y = 1; y < ph - 1; y++)
    for (let x = 1; x < pw - 1; x++) {
      const i = y * pw + x
      const gx = lumMap[i - pw + 1] + 2 * lumMap[i + 1] + lumMap[i + pw + 1] - lumMap[i - pw - 1] - 2 * lumMap[i - 1] - lumMap[i + pw - 1]
      const gy = lumMap[i + pw - 1] + 2 * lumMap[i + pw] + lumMap[i + pw + 1] - lumMap[i - pw - 1] - 2 * lumMap[i - pw] - lumMap[i - pw + 1]
      edgeMap[i] = smooth(0.5, 1.9, Math.hypot(gx, gy)) // fine detail (faint shading edges) is dropped
    }

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
  while (n < target && tries < target * 80) {
    tries++
    const x = Math.random() * pw
    const y = Math.random() * ph
    const i = (y | 0) * pw + (x | 0)
    if (px[i * 4 + 3] < 128) continue
    const sx = x * 2
    const sy = y * 2
    const gx = Math.min(gw - 2, Math.max(1, (x / G) | 0))
    const gy = Math.min(gh - 2, Math.max(1, (y / G) | 0))
    const dRaw = dist[gy * gw + gx]

    // Low-key light from the upper left: the figure bulges toward the viewer (depth), so its
    // upper-left flanks catch the light and the right and under sides fall into shadow.
    const nx = dist[gy * gw + gx - 1] - dist[gy * gw + gx + 1]
    const ny = dist[(gy - 1) * gw + gx] - dist[(gy + 1) * gw + gx]
    const light = Math.max(0, (nx * -0.62 + ny * -0.64 + 0.5) / Math.hypot(nx, ny, 1.1))
    const fall = 1 - 0.42 * smooth(1000, 2300, sy) // the legs sink into the dark

    let w: number
    let b: number
    const sd = visor[i]
    if (sd >= RIM) {
      // Dark glass: no face. A soft reflection runs along the upper-left of the rim.
      const side = Math.min(1, Math.max(0, (VISOR_C.x - sx + (VISOR_C.y - sy) * 1.2) / 260))
      const streak = Math.exp(-(((sd - 40) / 13) ** 2)) * smooth(0.3, 0.75, side)
      w = 0.55 + 0.4 * side + 2.1 * streak
      b = 0.17 + 0.2 * side + 0.75 * streak
    } else {
      const rim = Math.abs(sd) < RIM
      const e = rim ? 1 : edgeMap[i]
      const l = smooth(0.4, 0.92, lumMap[i]) // the drawing's own light and shadow
      const fill = (0.16 + 0.62 * l) * (0.38 + 0.9 * light) * fall
      const line = (0.62 + 0.38 * Math.min(1, light * 1.35)) * (0.6 + 0.4 * fall)
      w = detailWeight(sx, sy) * FILL + EDGE * e + (rim ? 1 : 0)
      b = fill + ((rim ? 1 : line) - fill) * e
    }
    if (Math.random() * MAX_WEIGHT > w) continue
    pos[n * 2] = sx
    pos[n * 2 + 1] = sy
    depth[n] = Math.sqrt(dRaw / maxD)
    lum[n] = Math.min(1, b * (0.8 + Math.random() * 0.4))
    const big = Math.random() < 0.06
    size[n] = big ? 1.4 + Math.random() * 0.9 : 0.72 + Math.random() * 0.45
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
  uniform vec2 uStream; // y of the wind ray the dots arrive along
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

    // Intro: one ray of sand blown in from off-screen left. The dots fly together as a single
    // ribbon that undulates like a slow wave, then the ribbon opens up into the figure.
    vec2 target = q;
    float h1 = hash(aRnd * 7.1);            // place along the ray: 0 head → 1 tail
    float h2 = hash(aRnd * 3.7 + 1.0);
    float h3 = hash(aRnd * 11.3 + 2.0);
    float g = clamp(uGather * 1.4 - h1 * 0.4, 0.0, 1.0);
    float gx = 1.0 - pow(1.0 - g, 1.8);
    float open = smoothstep(0.5, 1.0, g);  // 0 in the ray → 1 landed
    float flight = 1.0 - open;
    q.x = mix(-40.0 - h1 * uView.x * 0.3, target.x, gx);
    // The same wave for every dot (phase from position and time only), so the ray moves as one.
    float wave = sin(q.x * 0.0062 - uTime * 1.6) * 30.0 + sin(q.x * 0.0029 - uTime * 0.85) * 16.0;
    float across = (h2 + h3 - 1.0) * 30.0; // thin ribbon, densest along its middle
    q.y = mix(uStream.y + wave + across, target.y, open);

    // Exit: the dots fly off to the left, the far ones first.
    float e = clamp(uExit * 1.35 - aRnd * 0.35, 0.0, 1.0);
    float ee = e * e;
    q.x -= ee * uView.x * (0.8 + aRnd * 0.7);
    q.y += (aRnd - 0.5) * ee * 280.0;

    // Light is baked per dot (aLum). On top: a slow shadow drifting across the figure, like cloud
    // cover, and a twinkle on the bigger dots.
    float front = 0.8 + 0.2 * aDepth;
    front *= 0.84 + 0.16 * sin(aPos.y * 0.0042 + aPos.x * 0.0021 - uTime * 0.4);
    float tw = aSize > 1.25 ? 0.6 + 0.4 * sin(uTime * (1.5 + aRnd * 2.5) + aRnd * 60.0) : 1.0;

    gl_Position = vec4(q.x / uView.x * 2.0 - 1.0, 1.0 - q.y / uView.y * 2.0, 0.0, 1.0);
    // Sand in flight is finer and dimmer; x2.6 leaves room for the halo.
    gl_PointSize = uDot * aSize * uDpr * persp * mix(1.0, 0.7, flight) * 2.6;
    float visible = (g > 0.0 ? 1.0 : 0.0) * (1.0 - smoothstep(0.6, 1.0, e));
    vA = aLum * front * tw * visible * mix(1.0, 0.6, flight);
  }
`

const fragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0; // 0 centre → 1 edge
    if (d > 1.0) discard;
    float core = exp(-d * d * 22.0);
    float halo = exp(-d * d * 5.0) * 0.2;
    float i = (core + halo) * vA;
    gl_FragColor = vec4(uColor * i, min(1.0, i)); // premultiplied: only the light is added
  }
`

export function DotAstronaut({ scroll, onReady, reduce }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
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
      uStream: { value: new THREE.Vector2() },
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
      // Pure additive light (premultiplied): overlapping dots add up, nothing dark is drawn.
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneFactor,
    })
    let points: THREE.Points | null = null
    let img: HTMLImageElement | null = null
    let lay = layout(1, 1)

    const build = () => {
      if (!img) return
      const vw = canvas.clientWidth
      const vh = canvas.clientHeight
      lay = layout(vw, vh)
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      renderer.setPixelRatio(dpr)
      renderer.setSize(vw, vh, false)
      const scale = lay.h / IMG_H
      const s = sampleDots(img, scale, vw)
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
      // The wind ray comes in at the height of the helmet / chest.
      uniforms.uStream.value.set(0, Math.min(vh * 0.55, lay.top + lay.h * 0.28))
      uniforms.uDot.value = vw >= 1024 ? 2.8 : 2.3
    }

    // The figure turns gently toward the cursor (no light, no push).
    let nx = 0
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      nx = e.clientX / window.innerWidth - 0.5
    }
    if (!reduce) window.addEventListener('pointermove', onMove, { passive: true })

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
        if (reduce) {
          onReadyRef.current()
          return
        }
        gatherStart = performance.now() + 300
        window.setTimeout(() => onReadyRef.current(), 900)
      })
      .catch(() => onReadyRef.current())

    let raf = 0
    let running = false
    let last = performance.now()
    let time = 0
    let rot = 0
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      time += dt
      if (!reduce && gatherStart) uniforms.uGather.value = Math.min(1, Math.max(0, (now - gatherStart) / 3800))

      const s = scroll.get()
      uniforms.uShift.value = -s * lay.rise
      uniforms.uExit.value = reduce ? 0 : Math.min(1, Math.max(0, (s - 0.3) / 0.6))
      rot += ((reduce ? 0 : nx * 0.3 + Math.sin(time * 0.25) * 0.1) - rot) * (1 - Math.pow(0.05, dt))
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
      document.removeEventListener('visibilitychange', onVis)
      points?.geometry.dispose()
      material.dispose()
      renderer.dispose()
    }
  }, [reduce, scroll])

  return <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 size-full" />
}
