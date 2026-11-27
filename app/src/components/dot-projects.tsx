import { useEffect, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import type { MotionValue } from 'motion/react'
import { PROJECTS } from '@/data'
import { DOT_BLENDING, DOT_COLOR, DOT_FRAGMENT, seeded } from './dots'

/**
 * Featured work, carried by dots. The section is pinned; scrolling steps through the projects,
 * one at a time. For each step the same cloud of dots:
 *
 *   comes in as a ray from the left and expands into a soft cloud over where the project goes
 *   (an even scatter over the image) → the real image fades in as the dots fade, and the text
 *   simply fades in beside it → hold → the project fades back into the cloud → the cloud closes into a
 *   ray that flies off to the right, while the next ray comes in.
 *
 * The first project only has the ray coming in; after the last one there is only the ray leaving.
 * The dots do not draw the picture: they are just a cloud, so the project itself stays clean.
 *
 * This component runs the whole sequence from the scroll position: it draws the dots, and sets
 * each project's opacity (`opacities`) and the gentle floating of the image and text (`float`),
 * which the dots follow so they stay glued to what they cover. With reduced motion it only sets
 * the opacities (a plain crossfade), draws nothing and nothing floats.
 */

/** How the scroll maps to a project, in "project units" (`v` = distance from project k's slot). */
const T = {
  outFrom: -0.38, // previous project starts turning into dots
  outTo: -0.32,
  flyFrom: -0.3, // one ray leaves, another arrives
  flyTo: 0.04,
  inFrom: 0.03, // the new project fades in over the dots
  inTo: 0.12,
}

const vertex = /* glsl */ `
  uniform vec2 uView;
  uniform float uDpr;
  uniform float uTime;
  uniform float uFly;
  uniform float uMode;
  uniform float uAlpha;
  uniform vec2 uCard;   // card centre
  uniform vec3 uFloatI; // image: x, y, rotation (radians)
  uniform float uDot;
  attribute vec2 aFrom;
  attribute vec2 aTo;
  attribute vec2 aLum;  // brightness at from / to
  attribute vec2 aMeta; // size, random
  varying float vA;

  float hash(float n) { return fract(sin(n) * 43758.5453); }

  // What the dot forms floats gently; the dot floats with it.
  vec2 afloat(vec2 p) {
    vec2 d = p - uCard;
    float c = cos(uFloatI.z), s = sin(uFloatI.z);
    return uCard + vec2(d.x * c - d.y * s, d.x * s + d.y * c) + uFloatI.xy;
  }

  // The ray the dots travel in: a long, slow wave.
  float ray(float x, float y0, float rnd, float h2, float h3) {
    return y0 + sin(x / uView.x * 5.5 + 0.4 - uTime * 0.3) * uView.y * 0.06 + (rnd + h2 + h3 - 1.5) * 9.0;
  }

  void main() {
    float rnd = aMeta.y;
    float h2 = hash(rnd * 3.7 + 1.0);
    float h3 = hash(rnd * 11.3 + 2.0);
    float w = clamp(uFly * 1.4 - h3 * 0.4, 0.0, 1.0);
    // First half: leave in a ray off to the right. Second half: a ray comes in from the left.
    // uMode 1 = only the way in (first project), 2 = only the way out (after the last).
    float a = uMode > 1.5 ? w : uMode > 0.5 ? 1.0 : clamp(w * 2.0, 0.0, 1.0);
    float b = uMode > 1.5 ? 0.0 : uMode > 0.5 ? w : clamp(w * 2.0 - 1.0, 0.0, 1.0);

    vec2 from = afloat(aFrom);
    vec2 to = afloat(aTo);
    vec2 p;
    float flight;
    if (a < 1.0) {
      p.x = mix(from.x, uView.x + 60.0 + h2 * uView.x * 0.25, a * a);
      float close = smoothstep(0.0, 0.5, a); // the dots close into the ray, then ride it out
      p.y = mix(from.y, ray(p.x, uCard.y - uView.y * 0.1, rnd, h2, h3), close);
      flight = close;
    } else {
      p.x = mix(-60.0 - h2 * uView.x * 0.25, to.x, 1.0 - pow(1.0 - b, 1.8));
      float open = smoothstep(0.45, 1.0, b); // ...and open out of the ray onto their places
      p.y = mix(ray(p.x, uCard.y + uView.y * 0.08, rnd, h2, h3), to.y, open);
      flight = 1.0 - open;
    }
    p += vec2(sin(uTime * 1.3 + rnd * 40.0), cos(uTime * 1.1 + rnd * 31.0)) * 0.5;

    float lum = max(a < 1.0 ? aLum.x : aLum.y, 0.7 * flight);
    float tw = aMeta.x > 1.15 ? 0.6 + 0.4 * sin(uTime * (1.5 + rnd * 2.5) + rnd * 60.0) : 1.0;
    gl_Position = vec4(p.x / uView.x * 2.0 - 1.0, 1.0 - p.y / uView.y * 2.0, 0.0, 1.0);
    gl_PointSize = uDot * aMeta.x * uDpr * 2.6;
    vA = lum * tw * uAlpha;
  }
`

type Float = { cx: MotionValue<number>; cy: MotionValue<number>; cr: MotionValue<number>; tx: MotionValue<number>; ty: MotionValue<number> }

type Props = {
  /** The tall section whose scroll drives everything. */
  sectionRef: RefObject<HTMLElement | null>
  /** The pinned stage the canvas covers. */
  stageRef: RefObject<HTMLDivElement | null>
  /** The box the project images sit in (not transformed). */
  cardRef: RefObject<HTMLDivElement | null>
  /** One per project: 0 hidden → 1 shown. Set here. */
  opacities: MotionValue<number>[]
  /** The floating of the image (x, y, rotation in degrees) and of the text (x, y). Set here. */
  float: Float
  /** Screen heights of scrolling per project. */
  perProject: number
  reduce: boolean
}

export function DotProjects({ sectionRef, stageRef, cardRef, opacities, float, perProject, reduce }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    const stage = stageRef.current
    const card = cardRef.current
    const canvas = canvasRef.current
    if (!section || !stage || !card) return
    const N = PROJECTS.length
    const ramp = (v: number, from: number, to: number) => Math.min(1, Math.max(0, (v - from) / (to - from)))

    // ── Dots (skipped with reduced motion) ──────────────────────────────────────────────
    let gl: {
      renderer: THREE.WebGLRenderer
      scene: THREE.Scene
      camera: THREE.Camera
      points: THREE.Points
      material: THREE.ShaderMaterial
    } | null = null
    const uniforms = {
      uView: { value: new THREE.Vector2(1, 1) },
      uDpr: { value: 1 },
      uTime: { value: 0 },
      uFly: { value: 0 },
      uMode: { value: 0 },
      uAlpha: { value: 0 },
      uCard: { value: new THREE.Vector2() },
      uFloatI: { value: new THREE.Vector3() },
      uDot: { value: 2.4 },
      uColor: { value: DOT_COLOR },
    }
    if (!reduce && canvas) {
      try {
        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' })
        renderer.setClearColor(0x000000, 0)
        const material = new THREE.ShaderMaterial({ uniforms, vertexShader: vertex, fragmentShader: DOT_FRAGMENT, ...DOT_BLENDING })
        const points = new THREE.Points(new THREE.BufferGeometry(), material)
        points.frustumCulled = false
        const scene = new THREE.Scene()
        scene.add(points)
        gl = { renderer, scene, camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), points, material }
      } catch {
        gl = null // no WebGL: the projects simply crossfade
      }
    }

    let nImg = 0
    /** Per project, then two extra sets: where the dots come from (index N) and go to (N + 1). */
    let places: { pos: Float32Array; lum: Float32Array }[] = []
    let shown = -99 // the transition currently loaded into the buffers

    const layout = () => {
      if (!gl) return
      const vw = stage.clientWidth
      const vh = stage.clientHeight
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      gl.renderer.setPixelRatio(dpr)
      gl.renderer.setSize(vw, vh, false)
      uniforms.uView.value.set(vw, vh)
      uniforms.uDpr.value = dpr
      uniforms.uDot.value = vw >= 1024 ? 2.4 : 2
      const o = stage.getBoundingClientRect()
      const c = card.getBoundingClientRect()
      const cx = c.left - o.left
      const cy = c.top - o.top
      uniforms.uCard.value.set(cx + c.width / 2, cy + c.height / 2)
      const n = nImg
      const rand = seeded(53)
      places = PROJECTS.map(() => {
        const pos = new Float32Array(n * 2)
        const lum = new Float32Array(n)
        // Image: an even cloud over the card, a little denser toward the middle, soft at the edges.
        for (let i = 0; i < nImg; i++) {
          const soft = rand() < 0.3
          const x = soft ? (rand() + rand()) / 2 : rand()
          const y = soft ? (rand() + rand()) / 2 : rand()
          pos[i * 2] = cx + (x * 1.04 - 0.02) * c.width
          pos[i * 2 + 1] = cy + (y * 1.04 - 0.02) * c.height
          lum[i] = 0.25 + rand() * 0.6
        }
        return { pos, lum }
      })
      // Stand-ins for "no project" before the first and after the last (the rays ignore them).
      const off = (dx: number, y0: number, spread: number) => {
        const pos = new Float32Array(n * 2)
        const lum = new Float32Array(n).fill(0.75)
        for (let i = 0; i < n; i++) {
          pos[i * 2] = vw + 60 + rand() * vw * dx
          pos[i * 2 + 1] = vh * y0 + (rand() + rand() + rand() - 1.5) * spread
        }
        return { pos, lum }
      }
      places.push(off(0.35, 0.42, 30), off(0.5, 0.2, vh * 0.25))

      const geo = new THREE.BufferGeometry()
      const meta = new Float32Array(n * 2)
      const mr = seeded(71)
      for (let i = 0; i < n; i++) meta.set([mr() < 0.05 ? 1.2 + mr() * 0.5 : 0.55 + mr() * 0.4, mr()], i * 2)
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
      geo.setAttribute('aFrom', new THREE.BufferAttribute(new Float32Array(n * 2), 2))
      geo.setAttribute('aTo', new THREE.BufferAttribute(new Float32Array(n * 2), 2))
      geo.setAttribute('aLum', new THREE.BufferAttribute(new Float32Array(n * 2), 2))
      geo.setAttribute('aMeta', new THREE.BufferAttribute(meta, 2))
      gl.points.geometry.dispose()
      gl.points.geometry = geo
      shown = -99
    }

    /** Load transition k into the buffers: from project k - 1 (or the way in) to project k (or the way out). */
    const load = (k: number) => {
      if (!gl || !places.length) return
      const from = places[k - 1 >= 0 ? k - 1 : N]
      const to = places[k < N ? k : N + 1]
      const g = gl.points.geometry
      const aFrom = g.getAttribute('aFrom') as THREE.BufferAttribute
      const aTo = g.getAttribute('aTo') as THREE.BufferAttribute
      const aLum = g.getAttribute('aLum') as THREE.BufferAttribute
      ;(aFrom.array as Float32Array).set(from.pos)
      ;(aTo.array as Float32Array).set(to.pos)
      const l = aLum.array as Float32Array
      for (let i = 0; i < from.lum.length; i++) {
        l[i * 2] = from.lum[i]
        l[i * 2 + 1] = to.lum[i]
      }
      aFrom.needsUpdate = aTo.needsUpdate = aLum.needsUpdate = true
      shown = k
    }

    if (gl) {
      const wide = window.innerWidth >= 1024
      nImg = wide ? 5200 : 2600
      layout()
    }
    let layoutT = 0
    const relayout = () => {
      window.clearTimeout(layoutT)
      layoutT = window.setTimeout(layout, 200)
    }
    const ro = new ResizeObserver(relayout)
    ro.observe(stage)
    document.fonts?.ready.then(relayout).catch(() => {})

    // ── The sequence ────────────────────────────────────────────────────────────────────
    let raf = 0
    let running = false
    let last = performance.now()
    let time = 0
    let u = -1
    let first = true
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      time += dt
      const vh = window.innerHeight
      // Project units: 0 when the stage pins, + 1 per project scrolled.
      const target = -section.getBoundingClientRect().top / (perProject * vh)
      u = first ? target : u + (target - u) * (1 - Math.pow(0.003, dt))
      first = false
      const k = Math.floor(u - T.outFrom)
      const v = u - k

      // Without dots (reduced motion, no WebGL) the projects just crossfade.
      const dots = !!gl && places.length > 0
      for (let j = 0; j < N; j++) {
        let o = 0
        if (j === k) o = dots ? ramp(v, T.inFrom, T.inTo) : ramp(v, T.outFrom, T.outTo)
        else if (j === k - 1) o = 1 - ramp(v, T.outFrom, T.outTo)
        opacities[j].set(o)
      }

      if (!reduce) {
        // A slow drift, as if weightless.
        float.cx.set(Math.cos(time * 0.45) * 6)
        float.cy.set(Math.sin(time * 0.7) * 10)
        float.cr.set(Math.sin(time * 0.5) * 0.7)
        float.tx.set(Math.cos(time * 0.5 + 1) * 4)
        float.ty.set(Math.sin(time * 0.62 + 2) * 7)
      }

      if (gl && dots) {
        const inRange = k >= 0 && k <= N
        if (inRange && k !== shown) load(k)
        // Dots appear as the old project fades, stay through the flight, fade as the new one comes in.
        const alpha = inRange ? (k === 0 ? ramp(v, T.flyFrom - 0.04, T.flyFrom + 0.02) : ramp(v, T.outFrom, T.outTo)) * (1 - (k === N ? ramp(v, T.flyTo - 0.1, T.flyTo) : ramp(v, T.inFrom + 0.02, T.inTo))) : 0
        uniforms.uTime.value = time
        uniforms.uFly.value = ramp(v, T.flyFrom, T.flyTo)
        uniforms.uMode.value = k <= 0 ? 1 : k >= N ? 2 : 0
        uniforms.uAlpha.value = alpha
        uniforms.uFloatI.value.set(float.cx.get(), float.cy.get(), (float.cr.get() * Math.PI) / 180)
        gl.renderer.render(gl.scene, gl.camera)
      }
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
    let near = false
    const io = new IntersectionObserver(
      ([e]) => {
        near = e.isIntersecting
        if (near && !document.hidden) start()
        else stop()
      },
      { rootMargin: '50% 0px' },
    )
    io.observe(section)
    const onVis = () => (document.hidden || !near ? stop() : start())
    document.addEventListener('visibilitychange', onVis)

    return () => {
      stop()
      io.disconnect()
      ro.disconnect()
      window.clearTimeout(layoutT)
      document.removeEventListener('visibilitychange', onVis)
      if (gl) {
        gl.points.geometry.dispose()
        gl.material.dispose()
        gl.renderer.dispose()
      }
    }
  }, [sectionRef, stageRef, cardRef, opacities, float, perProject, reduce])

  if (reduce) return null
  return <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 z-10 size-full" />
}
