import * as THREE from 'three'

/** Shared by everything drawn in dots (the astronaut and the space behind the page). */
export const DOT_COLOR = new THREE.Color('#dbe6f7') // cold, pale blue-white

/** A soft round dot: bright core plus a small halo. Premultiplied, so only light is added. */
export const DOT_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0; // 0 centre → 1 edge
    if (d > 1.0) discard;
    float core = exp(-d * d * 22.0);
    float halo = exp(-d * d * 5.0) * 0.2;
    float i = (core + halo) * vA;
    gl_FragColor = vec4(uColor * i, min(1.0, i));
  }
`

/** Pure additive light: overlapping dots add up, nothing dark is drawn. */
export const DOT_BLENDING = {
  transparent: true,
  depthTest: false,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.OneFactor,
  blendDstAlpha: THREE.OneFactor,
} as const

/** Seeded random numbers, so rebuilding (resize) keeps every dot where it was. */
export function seeded(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Box = { x: number; y: number; w: number; h: number }

/**
 * One box per visible character inside `block`, relative to the block (so a translation applied
 * to the block does not matter). Used to land dots on real lines and words.
 */
export function textBoxes(block: HTMLElement): Box[] {
  const origin = block.getBoundingClientRect()
  const boxes: Box[] = []
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
