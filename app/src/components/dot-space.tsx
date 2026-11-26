import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useReducedMotion } from 'motion/react'
import { DOT_BLENDING, DOT_COLOR, DOT_FRAGMENT } from './dots'

/**
 * The space behind the whole page, drawn in the same dots as the astronaut: a field of stars, two
 * tilted spiral galaxies and two small planets. A fixed, full-screen canvas (one WebGL draw call)
 * that sits behind all the content; everything is dimmer and finer than the astronaut, so it
 * stays a background.
 *
 * - Scrolling moves it slowly (parallax). The stars wrap around, so they never run out. The first
 *   galaxy (upper left) and planet (upper right) belong to the intro; the second galaxy comes up
 *   with the projects and the second planet near the footer.
 * - The galaxies turn slowly; the planets spin and are lit from the upper left like the
 *   astronaut, so they show a bright limb and a dark side; the stars twinkle.
 * - It fades in dot by dot and shifts a little against the cursor.
 */

const STAR = 0
const GALAXY = 1
const PLANET = 2
const GALAXY_2 = 3
const PLANET_2 = 4

/** How fast things move with the page: stars 6–26% of the scroll, galaxies and planets 35%. */
const OBJECT_PARALLAX = 0.35

const vertex = /* glsl */ `
  uniform vec2 uView;
  uniform float uDpr;
  uniform float uTime;
  uniform float uFade;
  uniform float uScroll; // px
  uniform float uWrap;   // px: the stars repeat over this height
  uniform float uPar;
  uniform float uDot;
  attribute vec2 aCenter;
  attribute vec3 aLocal;
  attribute vec4 aMeta; // kind, brightness, size, random
  varying float vA;

  vec3 rotX(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c); }
  vec3 rotY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c); }
  vec3 rotZ(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x * c - p.y * s, p.x * s + p.y * c, p.z); }

  void main() {
    float kind = aMeta.x;
    float lum = aMeta.y;
    float rnd = aMeta.w;
    bool second = kind > 2.5;
    vec3 p = vec3(0.0);
    float vis = 1.0;
    vec2 s = aCenter;

    if (kind < 0.5) {
      float depth = aLocal.z; // how near
      lum *= 0.7 + 0.3 * sin(uTime * (0.6 + rnd * 1.8) + rnd * 50.0);
      s.y = mod(s.y - uScroll * (0.06 + 0.2 * depth), uWrap) - uWrap * 0.1;
      s.x -= uPar * 30.0 * depth;
    } else {
      if (kind < 1.5 || (second && kind < 3.5)) {
        // Galaxy: a disc turning slowly, seen at a slant.
        p = rotZ(aLocal, uTime * (second ? -0.024 : 0.03));
        p = rotX(p, second ? 1.22 : 1.08);
        p = rotZ(p, second ? 0.5 : -0.42);
      } else {
        // Planet: spins about its own axis, lit from the upper left; the far side is hidden.
        p = rotY(aLocal, uTime * (second ? 0.07 : 0.1));
        p = rotX(p, -0.4);
        p = rotZ(p, second ? 0.3 : -0.25);
        vec3 n = normalize(p);
        float light = max(0.0, dot(n, normalize(vec3(-0.62, -0.5, 0.6))));
        vis = smoothstep(-0.04, 0.12, n.z);
        lum *= 0.16 + 1.25 * light;
      }
      s += p.xy;
      s.y -= uScroll * ${OBJECT_PARALLAX.toFixed(2)};
      s.x -= uPar * 16.0;
    }

    float fade = clamp(uFade * 1.5 - rnd * 0.5, 0.0, 1.0);
    gl_Position = vec4(s.x / uView.x * 2.0 - 1.0, 1.0 - s.y / uView.y * 2.0, 0.0, 1.0);
    gl_PointSize = uDot * aMeta.z * uDpr * 2.6;
    vA = lum * vis * fade;
  }
`

/** Seeded random numbers, so rebuilding (resize, page height change) keeps every dot where it was. */
function seeded(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Spot = { x: number; y: number; r: number }

/**
 * Where things sit (css px; `y` is the place on screen before any scrolling). `maxScroll` is how
 * far the page scrolls: the second galaxy and planet are placed so they pass by further down.
 * On phones the astronaut is bottom right and the intro text is centred.
 */
function place(vw: number, vh: number, maxScroll: number) {
  const wide = vw >= 1024
  // On screen at `screenY` once the page has scrolled `at` of the way, and never before the intro is left.
  const later = (at: number, screenY: number) => Math.max(vh * 1.3, screenY * vh + OBJECT_PARALLAX * at * maxScroll)
  const far = maxScroll > vh * 1.5
  return {
    galaxy: wide ? { x: vw * 0.26, y: vh * 0.22, r: Math.min(vw * 0.17, vh * 0.27) } : { x: vw * 0.32, y: vh * 0.17, r: Math.min(vw * 0.33, vh * 0.2) },
    planet: wide ? { x: vw * 0.9, y: vh * 0.165, r: vh * 0.034 } : { x: vw * 0.84, y: vh * 0.24, r: vh * 0.016 },
    // Late in the page, on the right: it comes up with the projects and ends above the footer.
    galaxy2: far ? { x: vw * (wide ? 0.84 : 0.72), y: later(0.85, 0.4), r: wide ? Math.min(vw * 0.12, vh * 0.2) : Math.min(vw * 0.28, vh * 0.16) } : null,
    // At the end of the page, to the left of the footer.
    planet2: far ? { x: vw * (wide ? 0.16 : 0.14), y: later(1, 0.34), r: vh * (wide ? 0.042 : 0.02) } : null,
  }
}

function build(vw: number, vh: number, maxScroll: number) {
  const center: number[] = []
  const local: number[] = []
  const meta: number[] = []
  const rand = seeded(20261126)
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand())
  const add = (kind: number, cx: number, cy: number, x: number, y: number, z: number, lum: number, size: number) => {
    center.push(cx, cy)
    local.push(x, y, z)
    meta.push(kind, lum, size, rand())
  }
  const small = () => 0.5 + rand() * 0.4
  const at = place(vw, vh, maxScroll)
  const wrap = vh * 1.3

  // Stars: sparse, most of them faint; a few bigger ones.
  const stars = Math.round((vw * wrap) / 2300)
  for (let i = 0; i < stars; i++) {
    const big = rand() < 0.1
    add(STAR, rand() * vw * 1.06 - vw * 0.03, rand() * wrap, 0, 0, rand(), big ? 0.7 + rand() * 0.3 : 0.2 + rand() * 0.35, big ? 1.2 + rand() * 0.7 : small())
  }

  // Galaxy: a bright core, two spiral arms that thin out, and a faint haze between them.
  const galaxy = (kind: number, g: Spot, turns: number) => {
    const n = Math.round(Math.min(5200, (g.r * g.r) / 9))
    for (let i = 0; i < n; i++) {
      const pick = rand()
      let r: number
      let a: number
      let lum: number
      if (pick < 0.22) {
        r = Math.abs(gauss()) * 0.11 * g.r
        a = rand() * Math.PI * 2
        lum = 0.7 + rand() * 0.3
      } else if (pick < 0.82) {
        const t = Math.pow(rand(), 0.8)
        r = g.r * (0.1 + 0.9 * t) + gauss() * g.r * 0.035 * (0.6 + t)
        a = (rand() < 0.5 ? 0 : Math.PI) + t * turns + gauss() * 0.11
        lum = (0.85 - 0.45 * t) * (0.7 + rand() * 0.6)
      } else {
        r = Math.sqrt(rand()) * g.r
        a = rand() * Math.PI * 2
        lum = 0.16 + rand() * 0.18
      }
      const z = gauss() * g.r * 0.035 * Math.exp(-r / (g.r * 0.5))
      add(kind, g.x, g.y, Math.cos(a) * r, Math.sin(a) * r, z, Math.min(1, lum), rand() < 0.08 ? 1.1 + rand() * 0.6 : 0.6 + rand() * 0.4)
    }
  }
  galaxy(GALAXY, at.galaxy, 3.7)
  if (at.galaxy2) galaxy(GALAXY_2, at.galaxy2, 3.0)

  // Planet: dots at random on a sphere, with a few darker patches.
  const planet = (kind: number, o: Spot, patches: number) => {
    const n = Math.round(Math.min(7000, (4 * Math.PI * o.r * o.r) / 20))
    for (let i = 0; i < n; i++) {
      const ny = rand() * 2 - 1
      const a = rand() * Math.PI * 2
      const h = Math.sqrt(1 - ny * ny)
      const nx = Math.cos(a) * h
      const nz = Math.sin(a) * h
      const shade = 0.8 + 0.2 * Math.sin(nx * patches + 1.3) * Math.sin(ny * (patches + 1) + nz * 3)
      add(kind, o.x, o.y, nx * o.r, ny * o.r, nz * o.r, shade * (0.8 + rand() * 0.4), small())
    }
  }
  planet(PLANET, at.planet, 4)
  if (at.planet2) planet(PLANET_2, at.planet2, 6)

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((meta.length / 4) * 3), 3))
  geo.setAttribute('aCenter', new THREE.BufferAttribute(new Float32Array(center), 2))
  geo.setAttribute('aLocal', new THREE.BufferAttribute(new Float32Array(local), 3))
  geo.setAttribute('aMeta', new THREE.BufferAttribute(new Float32Array(meta), 4))
  return { geo, wrap }
}

export function DotSpace() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduce = !!useReducedMotion()

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
      uFade: { value: reduce ? 1 : 0 },
      uScroll: { value: 0 },
      uWrap: { value: 1 },
      uPar: { value: 0 },
      uDot: { value: 2 },
      uColor: { value: DOT_COLOR },
    }
    const material = new THREE.ShaderMaterial({ uniforms, vertexShader: vertex, fragmentShader: DOT_FRAGMENT, ...DOT_BLENDING })
    const points = new THREE.Points(new THREE.BufferGeometry(), material)
    points.frustumCulled = false
    scene.add(points)

    // Rebuild when the width, the height (by more than a phone's address bar) or the page length changes.
    const built = { vw: 0, vh: 0, max: -1 }
    const fit = () => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const max = Math.max(0, document.documentElement.scrollHeight - vh)
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      renderer.setPixelRatio(dpr)
      renderer.setSize(vw, vh, false)
      uniforms.uView.value.set(vw, vh)
      uniforms.uDpr.value = dpr
      uniforms.uDot.value = vw >= 1024 ? 2.4 : 2
      if (vw === built.vw && Math.abs(vh - built.vh) < 150 && Math.abs(max - built.max) < 60) return
      Object.assign(built, { vw, vh, max })
      const b = build(vw, vh, max)
      points.geometry.dispose()
      points.geometry = b.geo
      uniforms.uWrap.value = b.wrap
    }
    fit()
    let fitT = 0
    const refit = () => {
      window.clearTimeout(fitT)
      fitT = window.setTimeout(fit, 200)
    }
    window.addEventListener('resize', refit)
    const ro = new ResizeObserver(refit)
    ro.observe(document.body)

    let nx = 0
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') nx = e.clientX / window.innerWidth - 0.5
    }
    if (!reduce) window.addEventListener('pointermove', onMove, { passive: true })

    let raf = 0
    let running = false
    const started = performance.now()
    let last = started
    let time = 0
    let par = 0
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      time += dt
      par += ((reduce ? 0 : nx * 0.3) - par) * (1 - Math.pow(0.05, dt))
      uniforms.uTime.value = reduce ? 0 : time
      uniforms.uFade.value = reduce ? 1 : Math.min(1, (now - started) / 2800)
      uniforms.uScroll.value = window.scrollY
      uniforms.uPar.value = par
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
    const onVis = () => (document.hidden ? stop() : start())
    document.addEventListener('visibilitychange', onVis)
    start()

    return () => {
      stop()
      window.clearTimeout(fitT)
      window.removeEventListener('resize', refit)
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('visibilitychange', onVis)
      ro.disconnect()
      points.geometry.dispose()
      material.dispose()
      renderer.dispose()
    }
  }, [reduce])

  return <canvas ref={canvasRef} aria-hidden className="pointer-events-none fixed inset-0 -z-10 size-full" />
}
