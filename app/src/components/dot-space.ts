import * as THREE from 'three'

/**
 * The space behind the dot astronaut, drawn in the same dots: a field of stars, a tilted spiral
 * galaxy (upper left), a ringed planet (lower left, partly off-screen) and a small planet (upper
 * right, above the backpack). Everything is dimmer and finer than the astronaut, so it stays a
 * background.
 *
 * - The galaxy turns slowly; the planets spin and are lit from the upper left like the astronaut,
 *   so each shows a bright limb and a dark side; the stars twinkle.
 * - It fades in dot by dot, shifts a little against the cursor (parallax), and on scroll drifts
 *   up more slowly than the astronaut and fades out.
 *
 * One extra draw call in the astronaut's WebGL scene (see dot-astronaut.tsx).
 */

const STAR = 0
const GALAXY = 1
const PLANET = 2 // the ringed one
const MOON = 3 // the small one
const RING = 4

const vertex = /* glsl */ `
  uniform vec2 uView;
  uniform float uDpr;
  uniform float uTime;
  uniform float uFade;
  uniform float uScroll;
  uniform float uPar;
  uniform float uDot;
  attribute vec2 aCenter;
  attribute vec3 aLocal;
  attribute vec4 aMeta; // kind, brightness, size, random
  attribute float aRad;
  varying float vA;

  vec3 rotX(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c); }
  vec3 rotY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c); }
  vec3 rotZ(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x * c - p.y * s, p.x * s + p.y * c, p.z); }

  void main() {
    float kind = aMeta.x;
    float lum = aMeta.y;
    float rnd = aMeta.w;
    vec3 p = vec3(0.0);
    float depth = aLocal.z; // stars: how near (parallax)
    float vis = 1.0;

    if (kind < 0.5) {
      lum *= 0.7 + 0.3 * sin(uTime * (0.6 + rnd * 1.8) + rnd * 50.0);
    } else if (kind < 1.5) {
      // Galaxy: a disc turning slowly, seen at a slant.
      p = rotZ(aLocal, uTime * 0.03);
      p = rotX(p, 1.08);
      p = rotZ(p, -0.42);
      depth = 0.3;
    } else if (kind < 3.5) {
      // Planets: spin about their own axis, lit from the upper left; the far side is hidden.
      bool big = kind < 2.5;
      p = rotY(aLocal, uTime * (big ? 0.06 : 0.1));
      p = rotX(p, -0.4);
      p = rotZ(p, big ? 0.38 : -0.25);
      vec3 n = normalize(p);
      float light = max(0.0, dot(n, normalize(vec3(-0.62, -0.5, 0.6))));
      vis = smoothstep(-0.04, 0.12, n.z);
      lum *= 0.16 + 1.25 * light;
      depth = 0.6;
    } else {
      // Ring: same tilt as its planet; the part behind the planet is hidden.
      p = rotY(aLocal, uTime * 0.025);
      p = rotX(p, -0.4);
      p = rotZ(p, 0.38);
      if (p.z < 0.0 && length(p.xy) < aRad) vis = 0.0;
      // The planet's shadow falls across the ring, away from the light.
      vec2 away = normalize(vec2(0.62, 0.5));
      float along = dot(p.xy, away);
      float off = abs(dot(p.xy, vec2(-away.y, away.x)));
      if (along > 0.0) lum *= 0.25 + 0.75 * smoothstep(aRad * 0.8, aRad * 1.05, off);
      depth = 0.6;
    }

    vec2 s = aCenter + p.xy;
    s.x -= uPar * 30.0 * depth;
    s.y -= uScroll * uView.y * 0.3 * (0.3 + 0.7 * depth);

    float fade = clamp(uFade * 1.5 - rnd * 0.5, 0.0, 1.0) * (1.0 - smoothstep(0.45, 0.95, uScroll));
    gl_Position = vec4(s.x / uView.x * 2.0 - 1.0, 1.0 - s.y / uView.y * 2.0, 0.0, 1.0);
    gl_PointSize = uDot * aMeta.z * uDpr * 2.6;
    vA = lum * vis * fade;
  }
`

function gauss() {
  return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random())
}

/** Where things sit (css px). On phones the astronaut is bottom right and the text is centred. */
function place(vw: number, vh: number) {
  if (vw >= 1024)
    return {
      galaxy: { x: vw * 0.25, y: vh * 0.2, r: Math.min(vw * 0.13, vh * 0.21) },
      planet: { x: vw * 0.12, y: vh * 0.83, r: vh * 0.085 },
      moon: { x: vw * 0.9, y: vh * 0.165, r: vh * 0.034 },
    }
  return {
    galaxy: { x: vw * 0.3, y: vh * 0.17, r: vw * 0.27 },
    planet: { x: vw * 0.1, y: vh * 0.86, r: vh * 0.045 },
    moon: { x: vw * 0.84, y: vh * 0.24, r: vh * 0.016 },
  }
}

function build(vw: number, vh: number) {
  const center: number[] = []
  const local: number[] = []
  const meta: number[] = []
  const rad: number[] = []
  const add = (kind: number, cx: number, cy: number, x: number, y: number, z: number, lum: number, size: number, r = 0) => {
    center.push(cx, cy)
    local.push(x, y, z)
    meta.push(kind, lum, size, Math.random())
    rad.push(r)
  }
  const small = () => 0.5 + Math.random() * 0.4
  const at = place(vw, vh)

  // Stars: sparse, most of them faint; a few bigger ones.
  const stars = Math.round((vw * vh) / 2300)
  for (let i = 0; i < stars; i++) {
    const big = Math.random() < 0.1
    add(STAR, Math.random() * vw * 1.06 - vw * 0.03, Math.random() * vh * 1.3, 0, 0, Math.random(), big ? 0.7 + Math.random() * 0.3 : 0.2 + Math.random() * 0.35, big ? 1.2 + Math.random() * 0.7 : small())
  }

  // Galaxy: a bright core, two spiral arms that thin out, and a faint haze between them.
  const g = at.galaxy
  const gN = Math.round(Math.min(3600, (g.r * g.r) / 11))
  for (let i = 0; i < gN; i++) {
    const pick = Math.random()
    let r: number
    let a: number
    let lum: number
    if (pick < 0.22) {
      r = Math.abs(gauss()) * 0.11 * g.r
      a = Math.random() * Math.PI * 2
      lum = 0.5 + Math.random() * 0.4
    } else if (pick < 0.82) {
      const t = Math.pow(Math.random(), 0.8)
      r = g.r * (0.1 + 0.9 * t) + gauss() * g.r * 0.035 * (0.6 + t)
      a = (Math.random() < 0.5 ? 0 : Math.PI) + t * 3.7 + gauss() * 0.11
      lum = (0.6 - 0.38 * t) * (0.7 + Math.random() * 0.6)
    } else {
      r = Math.sqrt(Math.random()) * g.r
      a = Math.random() * Math.PI * 2
      lum = 0.1 + Math.random() * 0.14
    }
    const z = gauss() * g.r * 0.035 * Math.exp(-r / (g.r * 0.5))
    add(GALAXY, g.x, g.y, Math.cos(a) * r, Math.sin(a) * r, z, lum, Math.random() < 0.05 ? 1.0 + Math.random() * 0.5 : small())
  }

  // Planets: dots at random on a sphere. The big one has cloud bands and a ring with a gap.
  const sphere = (kind: number, o: { x: number; y: number; r: number }, shade: (nx: number, ny: number, nz: number) => number) => {
    const n = Math.round(Math.min(7000, (4 * Math.PI * o.r * o.r) / 20))
    for (let i = 0; i < n; i++) {
      const ny = Math.random() * 2 - 1
      const a = Math.random() * Math.PI * 2
      const h = Math.sqrt(1 - ny * ny)
      const nx = Math.cos(a) * h
      const nz = Math.sin(a) * h
      add(kind, o.x, o.y, nx * o.r, ny * o.r, nz * o.r, shade(nx, ny, nz) * (0.8 + Math.random() * 0.4), small(), o.r)
    }
  }
  sphere(PLANET, at.planet, (_x, y) => 0.72 + 0.26 * Math.sin(Math.asin(y) * 9 + 0.6))
  sphere(MOON, at.moon, (x, y, z) => 0.8 + 0.2 * Math.sin(x * 4 + 1.3) * Math.sin(y * 5 + z * 3))
  const p = at.planet
  const ringN = Math.round(Math.min(4200, (p.r * p.r) / 3.2))
  for (let i = 0; i < ringN; i++) {
    let t = Math.random()
    if (t > 0.56 && t < 0.64) t = Math.random() * 0.56 // the gap
    const r = p.r * (1.42 + 0.82 * t)
    const a = Math.random() * Math.PI * 2
    add(RING, p.x, p.y, Math.cos(a) * r, gauss() * 0.6, Math.sin(a) * r, (t < 0.56 ? 0.7 : 0.42) * (0.7 + Math.random() * 0.5), small(), p.r)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((meta.length / 4) * 3), 3))
  geo.setAttribute('aCenter', new THREE.BufferAttribute(new Float32Array(center), 2))
  geo.setAttribute('aLocal', new THREE.BufferAttribute(new Float32Array(local), 3))
  geo.setAttribute('aMeta', new THREE.BufferAttribute(new Float32Array(meta), 4))
  geo.setAttribute('aRad', new THREE.BufferAttribute(new Float32Array(rad), 1))
  return geo
}

export function createDotSpace(fragmentShader: string, color: THREE.Color) {
  const uniforms = {
    uView: { value: new THREE.Vector2(1, 1) },
    uDpr: { value: 1 },
    uTime: { value: 0 },
    uFade: { value: 0 },
    uScroll: { value: 0 },
    uPar: { value: 0 },
    uDot: { value: 2 },
    uColor: { value: color },
  }
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: vertex,
    fragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneFactor,
  })
  const points = new THREE.Points(new THREE.BufferGeometry(), material)
  points.frustumCulled = false
  points.renderOrder = -1
  return {
    points,
    resize(vw: number, vh: number, dpr: number) {
      points.geometry.dispose()
      points.geometry = build(vw, vh)
      uniforms.uView.value.set(vw, vh)
      uniforms.uDpr.value = dpr
      uniforms.uDot.value = vw >= 1024 ? 2.4 : 2
    },
    /** `fade` 0 → 1 as it appears, `scroll` 0 → 1 through the intro, `par` the smoothed cursor offset. */
    update(time: number, fade: number, scroll: number, par: number) {
      uniforms.uTime.value = time
      uniforms.uFade.value = fade
      uniforms.uScroll.value = scroll
      uniforms.uPar.value = par
    },
    dispose() {
      points.geometry.dispose()
      material.dispose()
    },
  }
}
