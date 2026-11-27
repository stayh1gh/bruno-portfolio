import { useEffect, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import type { MotionValue } from 'motion/react'
import { PROJECTS, type Media } from '@/data'
import { DOT_BLENDING, DOT_COLOR, DOT_FRAGMENT, seeded, textBoxes } from './dots'

/**
 * Featured work, made of dots. The section is pinned; scrolling steps through the projects, one
 * at a time. For each step the same cloud of dots:
 *
 *   forms the project (its image as a dotted drawing, its text as dotted lines) → the real image
 *   and text fade in over the dots → hold → the project fades back to dots → the dots swirl away
 *   and come back as the next project.
 *
 * The first project's dots fly in from the right; after the last one they fly off.
 *
 * This component runs the whole sequence from the scroll position: it draws the dots, and sets
 * each project's opacity (`opacities`) and the gentle floating of the image and text (`float`),
 * which the dots follow so they stay glued to what they form. With reduced motion it only sets
 * the opacities (a plain crossfade), draws nothing and nothing floats.
 *
 * Dot places: the image is sampled once per project (edges of the picture, so UI lines and type
 * show up as dotted contours); the text uses the real layout, one box per character.
 */

/** How the scroll maps to a project, in "project units" (`v` = distance from project k's slot). */
const T = {
  outFrom: -0.28, // previous project starts turning into dots
  outTo: -0.22,
  flyFrom: -0.2, // dots leave, swirl, arrive
  flyTo: 0.04,
  inFrom: 0.03, // the new project fades in over the dots
  inTo: 0.12,
}

const SAMPLE_W = 320
const SAMPLE_H = 200 // 16:10, like the card

const vertex = /* glsl */ `
  uniform vec2 uView;
  uniform float uDpr;
  uniform float uTime;
  uniform float uFly;
  uniform float uAlpha;
  uniform vec2 uCard;   // card centre
  uniform vec3 uFloatI; // image: x, y, rotation (radians)
  uniform vec2 uFloatT; // text: x, y
  uniform float uDot;
  attribute vec2 aFrom;
  attribute vec2 aTo;
  attribute vec2 aLum;  // brightness at from / to
  attribute vec3 aMeta; // kind (0 image, 1 text), size, random
  varying float vA;

  float hash(float n) { return fract(sin(n) * 43758.5453); }

  // What the dot forms floats gently; the dot floats with it.
  vec2 afloat(vec2 p, float kind) {
    if (kind > 0.5) return p + uFloatT;
    vec2 d = p - uCard;
    float c = cos(uFloatI.z), s = sin(uFloatI.z);
    return uCard + vec2(d.x * c - d.y * s, d.x * s + d.y * c) + uFloatI.xy;
  }

  void main() {
    float kind = aMeta.x;
    float rnd = aMeta.z;
    float h2 = hash(rnd * 3.7 + 1.0);
    float w = clamp(uFly * 1.4 - rnd * 0.4, 0.0, 1.0);
    float e = w * w * (3.0 - 2.0 * w);
    float away = sin(3.14159 * w); // 0 in place, 1 furthest out

    vec2 p = mix(afloat(aFrom, kind), afloat(aTo, kind), e);
    // Vanish: each dot swirls out on its own arc while the whole cloud drifts off and comes back.
    float ang = rnd * 6.2831 + w * 2.6;
    p += vec2(cos(ang), sin(ang)) * away * (50.0 + h2 * uView.x * 0.14);
    p += vec2(uView.x * 0.12, -uView.y * 0.07) * away;
    p += vec2(sin(uTime * 1.3 + rnd * 40.0), cos(uTime * 1.1 + rnd * 31.0)) * 0.5;

    float lum = max(mix(aLum.x, aLum.y, e), 0.55 * away);
    float tw = aMeta.y > 1.15 ? 0.6 + 0.4 * sin(uTime * (1.5 + rnd * 2.5) + rnd * 60.0) : 1.0;
    gl_Position = vec4(p.x / uView.x * 2.0 - 1.0, 1.0 - p.y / uView.y * 2.0, 0.0, 1.0);
    gl_PointSize = uDot * aMeta.y * uDpr * 2.6;
    vA = lum * tw * uAlpha;
  }
`

function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/** A stand-in drawing for the Chomp card (it is a live component, not a picture): its four steps. */
function drawChomp(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, SAMPLE_W, SAMPLE_H)
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 1.5
  const y = SAMPLE_H * 0.46
  const w = 46
  const gap = 20
  const x0 = (SAMPLE_W - (w * 4 + gap * 3)) / 2
  for (let i = 0; i < 4; i++) {
    const x = x0 + i * (w + gap)
    ctx.beginPath()
    ctx.roundRect(x, y - 9, w, 18, 9)
    ctx.stroke()
    ctx.fillStyle = '#fff'
    ctx.fillRect(x + 10, y - 1.5, w - 20, 3)
    if (i < 3) {
      ctx.beginPath()
      ctx.moveTo(x + w + 3, y)
      ctx.lineTo(x + w + gap - 3, y)
      ctx.stroke()
    }
  }
  ctx.fillRect(SAMPLE_W / 2 - 34, y + 26, 68, 2.5)
}

/** Sample a project's picture into dots: normalised places (0–1 across the card) and brightness. */
async function sampleMedia(media: Media, count: number, rand: () => number) {
  const cv = document.createElement('canvas')
  cv.width = SAMPLE_W
  cv.height = SAMPLE_H
  const ctx = cv.getContext('2d', { willReadFrequently: true })!
  if (media.kind === 'chomp') drawChomp(ctx)
  else {
    const img = await loadImage(media.kind === 'video' ? media.poster : media.src)
    ctx.fillStyle = (media.kind === 'image' && media.bg) || '#0b0c12'
    ctx.fillRect(0, 0, SAMPLE_W, SAMPLE_H)
    if (img) {
      // Same crop as the card: object-fit cover, with the card's object-position.
      const s = Math.max(SAMPLE_W / img.naturalWidth, SAMPLE_H / img.naturalHeight)
      const dw = img.naturalWidth * s
      const dh = img.naturalHeight * s
      const top = media.kind === 'image' && media.position?.includes('top')
      ctx.drawImage(img, (SAMPLE_W - dw) / 2, top ? 0 : (SAMPLE_H - dh) / 2, dw, dh)
    }
  }
  const px = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data
  const n = SAMPLE_W * SAMPLE_H
  const lumMap = new Float32Array(n)
  for (let i = 0; i < n; i++) lumMap[i] = (0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) / 255
  // Edges: where the picture changes (UI lines, type, shapes).
  const edge = new Float32Array(n)
  for (let y = 1; y < SAMPLE_H - 1; y++)
    for (let x = 1; x < SAMPLE_W - 1; x++) {
      const i = y * SAMPLE_W + x
      const w = SAMPLE_W
      const gx = lumMap[i - w + 1] + 2 * lumMap[i + 1] + lumMap[i + w + 1] - lumMap[i - w - 1] - 2 * lumMap[i - 1] - lumMap[i + w - 1]
      const gy = lumMap[i + w - 1] + 2 * lumMap[i + w] + lumMap[i + w + 1] - lumMap[i - w - 1] - 2 * lumMap[i - w] - lumMap[i - w + 1]
      const t = Math.min(1, Math.max(0, (Math.hypot(gx, gy) - 0.12) / 0.9))
      edge[i] = t * t * (3 - 2 * t)
    }
  const pos = new Float32Array(count * 2)
  const lum = new Float32Array(count)
  let k = 0
  let tries = 0
  while (k < count && tries < count * 200) {
    tries++
    let x = rand()
    let y = rand()
    let l: number
    if (rand() < 0.07) {
      // The card's own outline.
      if (rand() < 0.5) y = rand() < 0.5 ? 0.004 : 0.996
      else x = rand() < 0.5 ? 0.003 : 0.997
      l = 0.7
    } else {
      const e = edge[Math.min(SAMPLE_H - 1, (y * SAMPLE_H) | 0) * SAMPLE_W + Math.min(SAMPLE_W - 1, (x * SAMPLE_W) | 0)]
      if (rand() > 0.05 + e) continue
      l = 0.22 + 0.78 * e
    }
    pos[k * 2] = x
    pos[k * 2 + 1] = y
    lum[k] = Math.min(1, l * (0.8 + rand() * 0.4))
    k++
  }
  return { pos, lum }
}

type Float = { cx: MotionValue<number>; cy: MotionValue<number>; cr: MotionValue<number>; tx: MotionValue<number>; ty: MotionValue<number> }

type Props = {
  /** The tall section whose scroll drives everything. */
  sectionRef: RefObject<HTMLElement | null>
  /** The pinned stage the canvas covers. */
  stageRef: RefObject<HTMLDivElement | null>
  /** The box the project images sit in (not transformed). */
  cardRef: RefObject<HTMLDivElement | null>
  /** One text panel per project. */
  panelRefs: RefObject<(HTMLDivElement | null)[]>
  /** One per project: 0 hidden → 1 shown. Set here. */
  opacities: MotionValue<number>[]
  /** The floating of the image (x, y, rotation in degrees) and of the text (x, y). Set here. */
  float: Float
  /** Screen heights of scrolling per project. */
  perProject: number
  reduce: boolean
}

export function DotProjects({ sectionRef, stageRef, cardRef, panelRefs, opacities, float, perProject, reduce }: Props) {
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
      uAlpha: { value: 0 },
      uCard: { value: new THREE.Vector2() },
      uFloatI: { value: new THREE.Vector3() },
      uFloatT: { value: new THREE.Vector2() },
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

    let disposed = false
    let nImg = 0
    let nTxt = 0
    let samples: { pos: Float32Array; lum: Float32Array }[] | null = null
    /** Per project, then two extra sets: where the dots come from (index N) and go to (N + 1). */
    let places: { pos: Float32Array; lum: Float32Array }[] = []
    let shown = -99 // the transition currently loaded into the buffers

    const layout = () => {
      if (!gl || !samples) return
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
      const n = nImg + nTxt
      const rand = seeded(53)
      places = PROJECTS.map((_, k) => {
        const pos = new Float32Array(n * 2)
        const lum = new Float32Array(n)
        const s = samples![k]
        for (let i = 0; i < nImg; i++) {
          pos[i * 2] = cx + s.pos[i * 2] * c.width
          pos[i * 2 + 1] = cy + s.pos[i * 2 + 1] * c.height
          lum[i] = s.lum[i]
        }
        const panel = panelRefs.current[k]
        const slot = panel?.parentElement?.parentElement // the untransformed text slot
        if (panel && slot) {
          const sr = slot.getBoundingClientRect()
          const boxes = textBoxes(panel)
          if (!boxes.length) boxes.push({ x: 0, y: 0, w: panel.offsetWidth, h: panel.offsetHeight })
          for (let i = nImg; i < n; i++) {
            const b = boxes[(rand() * boxes.length) | 0]
            // Every panel starts at the slot's top-left corner (they share one grid cell).
            pos[i * 2] = sr.left - o.left + b.x + rand() * b.w
            pos[i * 2 + 1] = sr.top - o.top + b.y + rand() * b.h
            lum[i] = 0.5 + rand() * 0.5
          }
        }
        return { pos, lum }
      })
      // In: a ray from off-screen right. Out: off to the upper right.
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
      const meta = new Float32Array(n * 3)
      const mr = seeded(71)
      for (let i = 0; i < n; i++) meta.set([i < nImg ? 0 : 1, mr() < 0.05 ? 1.2 + mr() * 0.5 : 0.55 + mr() * 0.4, mr()], i * 3)
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
      geo.setAttribute('aFrom', new THREE.BufferAttribute(new Float32Array(n * 2), 2))
      geo.setAttribute('aTo', new THREE.BufferAttribute(new Float32Array(n * 2), 2))
      geo.setAttribute('aLum', new THREE.BufferAttribute(new Float32Array(n * 2), 2))
      geo.setAttribute('aMeta', new THREE.BufferAttribute(meta, 3))
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
      nImg = wide ? 7000 : 3600
      nTxt = wide ? 1400 : 800
      const rand = seeded(97)
      Promise.all(PROJECTS.map((p) => sampleMedia(p.media, nImg, rand))).then((s) => {
        if (disposed) return
        samples = s
        layout()
      })
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

      // Without dots (reduced motion, no WebGL, pictures not sampled yet) the projects just crossfade.
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
        uniforms.uAlpha.value = alpha
        uniforms.uFloatI.value.set(float.cx.get(), float.cy.get(), (float.cr.get() * Math.PI) / 180)
        uniforms.uFloatT.value.set(float.tx.get(), float.ty.get())
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
      disposed = true
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
  }, [sectionRef, stageRef, cardRef, panelRefs, opacities, float, perProject, reduce])

  if (reduce) return null
  return <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 z-10 size-full" />
}
