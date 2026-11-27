import { useEffect, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import type { MotionValue } from 'motion/react'
import { DOT_BLENDING, DOT_COLOR, DOT_FRAGMENT, seeded, textBoxes } from './dots'

/**
 * The dots travel from the astronaut to the statement and become its text. After they leave the
 * astronaut to the right (dot-astronaut.tsx), they come back in from the right as one ray of
 * sand and fly straight onto the lines of the statement's text, top line first; the text appears
 * as the dots fade.
 *
 * Everything follows the scroll, through where the text block is on screen (its centre, in
 * screen heights): the flight as it comes up from the bottom, then the fade to text. Scrolling
 * back up plays it in reverse. `reveal` (0 → 1) drives the text's opacity (statement.tsx).
 *
 * The dots' places in the text come from the real layout (one box per character), so they land
 * on the actual lines and words. A fixed full-screen canvas, one WebGL draw call, drawn only
 * while the transition is on screen.
 */

const COUNT = 2600

const vertex = /* glsl */ `
  uniform vec2 uView;
  uniform float uDpr;
  uniform float uTime;
  uniform float uFlight;
  uniform float uFade;
  uniform vec2 uOrigin;
  uniform float uStartY;
  uniform float uDot;
  attribute vec2 aTarget; // place in the text, relative to the text block
  attribute vec4 aMeta;   // order (reading order of its place), brightness, size, random
  varying float vA;

  float hash(float n) { return fract(sin(n) * 43758.5453); }

  void main() {
    float order = aMeta.x;
    float rnd = aMeta.w;
    float h2 = hash(rnd * 3.7 + 1.0);
    float h3 = hash(rnd * 11.3 + 2.0);
    float h4 = hash(rnd * 5.3 + 4.0);
    vec2 place = uOrigin + aTarget + vec2(sin(uTime * 1.3 + rnd * 40.0), cos(uTime * 1.1 + rnd * 31.0)) * 0.6;

    // One ray from off-screen right, in a long wave; each dot peels off onto its place in the
    // text when its turn comes, so the lines fill in reading order.
    float g = clamp(uFlight * 1.6 - order * 0.6, 0.0, 1.0);
    float gx = 1.0 - pow(1.0 - g, 1.8);
    float open = smoothstep(0.45, 1.0, g);
    vec2 q;
    q.x = mix(uView.x + 40.0 + h2 * uView.x * 0.3, place.x, gx);
    float sweep = sin(q.x / uView.x * 5.5 + 0.4 - uTime * 0.3) * uView.y * 0.08;
    q.y = mix(uStartY + sweep + (h2 + h3 + h4 - 1.5) * 9.0, place.y, open);

    // The dots fade one by one as the letters come in.
    float gone = clamp(uFade * 1.5 - h3 * 0.5, 0.0, 1.0);
    float bright = mix(max(aMeta.y, 0.75), aMeta.y, open);

    gl_Position = vec4(q.x / uView.x * 2.0 - 1.0, 1.0 - q.y / uView.y * 2.0, 0.0, 1.0);
    gl_PointSize = uDot * aMeta.z * uDpr * 2.6;
    vA = bright * (1.0 - gone) * (g > 0.0 ? 1.0 : 0.0);
  }
`

type Props = {
  /** The statement's text block: where the dots land. */
  blockRef: RefObject<HTMLDivElement | null>
  /** 0 → 1: set here as the dots turn into the text. */
  reveal: MotionValue<number>
}

export function DotTransit({ blockRef, reveal }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const block = blockRef.current
    if (!canvas || !block) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' })
    } catch {
      reveal.set(1) // no WebGL: just show the text
      return
    }
    renderer.setClearColor(0x000000, 0)
    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const uniforms = {
      uView: { value: new THREE.Vector2(1, 1) },
      uDpr: { value: 1 },
      uTime: { value: 0 },
      uFlight: { value: 0 },
      uFade: { value: 0 },
      uOrigin: { value: new THREE.Vector2() },
      uStartY: { value: 0 },
      uDot: { value: 2.6 },
      uColor: { value: DOT_COLOR },
    }
    const material = new THREE.ShaderMaterial({ uniforms, vertexShader: vertex, fragmentShader: DOT_FRAGMENT, ...DOT_BLENDING })
    const points = new THREE.Points(new THREE.BufferGeometry(), material)
    points.frustumCulled = false
    scene.add(points)

    const build = () => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      renderer.setPixelRatio(dpr)
      renderer.setSize(vw, vh, false)
      uniforms.uView.value.set(vw, vh)
      uniforms.uDpr.value = dpr
      uniforms.uDot.value = vw >= 1024 ? 2.6 : 2.2
      uniforms.uStartY.value = vh * 0.42

      const boxes = textBoxes(block)
      if (!boxes.length) boxes.push({ x: 0, y: 0, w: block.offsetWidth, h: block.offsetHeight })
      const bw = block.offsetWidth || 1
      const bh = block.offsetHeight || 1
      const rand = seeded(31)
      const n = vw >= 1024 ? COUNT : Math.round(COUNT * 0.7)
      const target = new Float32Array(n * 2)
      const meta = new Float32Array(n * 4)
      for (let i = 0; i < n; i++) {
        const b = boxes[(rand() * boxes.length) | 0]
        const x = b.x + rand() * b.w
        const y = b.y + rand() * b.h
        target[i * 2] = x
        target[i * 2 + 1] = y
        // Reading order: top line first, and along each line from the left.
        const order = Math.min(1, Math.max(0, (y / bh) * 0.8 + (x / bw) * 0.14 + rand() * 0.06))
        meta.set([order, 0.45 + rand() * 0.5, rand() < 0.07 ? 1.2 + rand() * 0.6 : 0.62 + rand() * 0.4, rand()], i * 4)
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
      geo.setAttribute('aTarget', new THREE.BufferAttribute(target, 2))
      geo.setAttribute('aMeta', new THREE.BufferAttribute(meta, 4))
      points.geometry.dispose()
      points.geometry = geo
    }
    build()
    let buildT = 0
    const rebuild = () => {
      window.clearTimeout(buildT)
      buildT = window.setTimeout(build, 200)
    }
    const ro = new ResizeObserver(rebuild)
    ro.observe(block)
    window.addEventListener('resize', rebuild)
    document.fonts?.ready.then(rebuild).catch(() => {})

    let raf = 0
    let time = 0
    let last = performance.now()
    let flight = 0
    let fade = 0
    let drawn = true
    const ramp = (v: number, from: number, to: number) => Math.min(1, Math.max(0, (v - from) / (to - from)))
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      time += dt
      const vh = window.innerHeight
      const r = block.getBoundingClientRect()
      // Where the text block's centre is, in screen heights: 1.5 as its section enters, 0.5 centred.
      const d = (r.top + r.height / 2) / vh
      const k = 1 - Math.pow(0.002, dt)
      flight += (ramp(d, 1.22, 0.74) - flight) * k
      fade += (ramp(d, 0.72, 0.58) - fade) * k
      reveal.set(fade > 0.999 ? 1 : fade)

      const active = flight > 0.001 && fade < 0.999
      if (active || drawn) {
        uniforms.uTime.value = time
        uniforms.uFlight.value = flight
        uniforms.uFade.value = fade
        uniforms.uOrigin.value.set(r.left, r.top)
        renderer.render(scene, camera) // one last frame after it ends clears the canvas
        drawn = active
      }
      raf = requestAnimationFrame(frame)
    }
    const start = () => {
      cancelAnimationFrame(raf)
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }
    const onVis = () => (document.hidden ? cancelAnimationFrame(raf) : start())
    document.addEventListener('visibilitychange', onVis)
    start()

    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(buildT)
      ro.disconnect()
      window.removeEventListener('resize', rebuild)
      document.removeEventListener('visibilitychange', onVis)
      points.geometry.dispose()
      material.dispose()
      renderer.dispose()
    }
  }, [blockRef, reveal])

  return <canvas ref={canvasRef} aria-hidden className="pointer-events-none fixed inset-0 -z-10 size-full" />
}
