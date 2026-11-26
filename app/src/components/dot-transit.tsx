import { useEffect, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import type { MotionValue } from 'motion/react'
import { DOT_BLENDING, DOT_COLOR, DOT_FRAGMENT } from './dots'

/**
 * The dots travel from the astronaut to the statement. After they leave the astronaut to the
 * right (dot-astronaut.tsx), they come back in from the right as one ray of sand, gather into a
 * small turning orb that waits low on the screen, then expand into the lines of the statement's
 * text, and the text appears as the dots fade.
 *
 * Everything follows the scroll, through where the text block is on screen (its centre, in
 * screen heights): flight while it rises from below, expansion as it comes up to the orb, then
 * the fade to text. Scrolling back up plays it in reverse. `reveal` (0 → 1) drives the text's
 * opacity (statement.tsx).
 *
 * The dots' places in the text come from the real layout (one box per character), so they land
 * on the actual lines and words. A fixed full-screen canvas, one WebGL draw call, drawn only
 * while the transition is on screen.
 */

const COUNT = 2600
const ORB = 46 // radius of the gathered orb, css px

const vertex = /* glsl */ `
  uniform vec2 uView;
  uniform float uDpr;
  uniform float uTime;
  uniform float uFlight;
  uniform float uExpand;
  uniform float uFade;
  uniform vec2 uOrb;
  uniform vec2 uOrigin;
  uniform float uStartY;
  uniform float uDot;
  attribute vec2 aTarget; // place in the text, relative to the text block
  attribute vec3 aSphere; // place on the orb (unit sphere)
  attribute vec4 aMeta;   // place along the ray, brightness, size, random
  attribute float aDust;  // 1: not part of the text, drifts off instead
  varying float vA;

  float hash(float n) { return fract(sin(n) * 43758.5453); }

  void main() {
    float h1 = aMeta.x;
    float rnd = aMeta.w;
    float h2 = hash(rnd * 3.7 + 1.0);
    float h3 = hash(rnd * 11.3 + 2.0);
    float h4 = hash(rnd * 5.3 + 4.0);

    // The orb: dots on a small sphere, turning.
    float a = uTime * 0.9;
    vec3 sp = vec3(aSphere.x * cos(a) + aSphere.z * sin(a), aSphere.y, -aSphere.x * sin(a) + aSphere.z * cos(a));
    vec2 orb = uOrb + sp.xy * ${ORB.toFixed(1)} * (0.55 + 0.45 * h4);

    // Flight: one ray from off-screen right, in a long wave, closing into the orb.
    float g = clamp(uFlight * 1.45 - h1 * 0.45, 0.0, 1.0);
    float gx = 1.0 - pow(1.0 - g, 1.8);
    float open = smoothstep(0.5, 1.0, g);
    vec2 q;
    q.x = mix(uView.x + 40.0 + h1 * uView.x * 0.45, orb.x, gx);
    float sweep = sin(q.x / uView.x * 5.5 + 0.4 - uTime * 0.3) * uView.y * 0.08;
    q.y = mix(uStartY + sweep + (h2 + h3 + h4 - 1.5) * 9.0, orb.y, open);

    // Expansion: out of the orb, onto the text's lines; the rest scatters as dust.
    float e = clamp(uExpand * 1.35 - rnd * 0.35, 0.0, 1.0);
    e = e * e * (3.0 - 2.0 * e);
    float ang = rnd * 6.2831;
    vec2 dust = orb + vec2(cos(ang), sin(ang)) * (140.0 + h2 * uView.x * 0.3);
    vec2 place = uOrigin + aTarget + vec2(sin(uTime * 1.3 + rnd * 40.0), cos(uTime * 1.1 + rnd * 31.0)) * 0.6;
    q = mix(q, aDust > 0.5 ? dust : place, e);

    // Fade: dust fades as it spreads; the text's dots fade one by one as the letters come in.
    float gone = aDust > 0.5 ? e : clamp(uFade * 1.5 - h3 * 0.5, 0.0, 1.0);
    float bright = mix(max(aMeta.y, 0.7), aMeta.y, open) * mix(0.55, 1.0, e);

    gl_Position = vec4(q.x / uView.x * 2.0 - 1.0, 1.0 - q.y / uView.y * 2.0, 0.0, 1.0);
    gl_PointSize = uDot * aMeta.z * uDpr * 2.6;
    vA = bright * (1.0 - gone) * (g > 0.0 ? 1.0 : 0.0);
  }
`

function seeded(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** One box per visible character (and the button's outline), relative to the block. */
function textBoxes(block: HTMLElement) {
  const origin = block.getBoundingClientRect()
  const boxes: { x: number; y: number; w: number; h: number }[] = []
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? ''
    for (let i = 0; i < text.length; i++) {
      if (!text[i].trim()) continue
      range.setStart(node, i)
      range.setEnd(node, i + 1)
      const r = range.getClientRects()[0]
      if (!r || !r.width) continue
      // Keep to the band where the letters are (not the full line height).
      boxes.push({ x: r.left - origin.left, y: r.top - origin.top + r.height * 0.3, w: r.width, h: r.height * 0.48 })
    }
  }
  return boxes
}

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
      uExpand: { value: 0 },
      uFade: { value: 0 },
      uOrb: { value: new THREE.Vector2() },
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
      const rand = seeded(31)
      const n = vw >= 1024 ? COUNT : Math.round(COUNT * 0.7)
      const target = new Float32Array(n * 2)
      const sphere = new Float32Array(n * 3)
      const meta = new Float32Array(n * 4)
      const dust = new Float32Array(n)
      for (let i = 0; i < n; i++) {
        const isDust = !boxes.length || rand() < 0.16
        if (!isDust) {
          const b = boxes[(rand() * boxes.length) | 0]
          target[i * 2] = b.x + rand() * b.w
          target[i * 2 + 1] = b.y + rand() * b.h
        }
        dust[i] = isDust ? 1 : 0
        const y = rand() * 2 - 1
        const a = rand() * Math.PI * 2
        const h = Math.sqrt(1 - y * y)
        sphere.set([Math.cos(a) * h, y, Math.sin(a) * h], i * 3)
        meta.set([rand(), 0.45 + rand() * 0.5, rand() < 0.07 ? 1.2 + rand() * 0.6 : 0.62 + rand() * 0.4, rand()], i * 4)
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
      geo.setAttribute('aTarget', new THREE.BufferAttribute(target, 2))
      geo.setAttribute('aSphere', new THREE.BufferAttribute(sphere, 3))
      geo.setAttribute('aMeta', new THREE.BufferAttribute(meta, 4))
      geo.setAttribute('aDust', new THREE.BufferAttribute(dust, 1))
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
    let expand = 0
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
      flight += (ramp(d, 1.5, 1.02) - flight) * k
      expand += (ramp(d, 0.9, 0.7) - expand) * k
      fade += (ramp(d, 0.74, 0.6) - fade) * k
      reveal.set(fade > 0.999 ? 1 : fade)

      const active = flight > 0.001 && fade < 0.999
      if (active || drawn) {
        uniforms.uTime.value = time
        uniforms.uFlight.value = flight
        uniforms.uExpand.value = expand
        uniforms.uFade.value = fade
        // The orb waits low on the screen until the text comes up to it.
        uniforms.uOrb.value.set(r.left + r.width / 2, Math.min(d, 0.76) * vh)
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
