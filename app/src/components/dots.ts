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
