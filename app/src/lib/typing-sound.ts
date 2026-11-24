// Subtle typing clicks, synthesised with Web Audio (no audio files).
// Browsers only allow sound after the visitor clicks or presses a key, so the clicks
// start from the first interaction; the toggle in the corner turns them off.

let ctx: AudioContext | null = null
let noise: AudioBuffer | null = null
let enabled = readPref()
let lastAt = 0
const listeners = new Set<(on: boolean) => void>()

function readPref() {
  try {
    return localStorage.getItem('typing-sound') !== 'off'
  } catch {
    return true
  }
}

export function soundEnabled() {
  return enabled
}

export function setSoundEnabled(on: boolean) {
  enabled = on
  try {
    localStorage.setItem('typing-sound', on ? 'on' : 'off')
  } catch {
    /* storage blocked */
  }
  if (on) unlockAudio()
  listeners.forEach((l) => l(on))
}

export function onSoundChange(fn: (on: boolean) => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** Call from a user gesture (click / key). */
export function unlockAudio() {
  if (!enabled) return
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    ctx = new AC()
    const len = Math.floor(ctx.sampleRate * 0.05)
    noise = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3
  }
  if (ctx.state === 'suspended') void ctx.resume()
}

/** One soft key click. `kind` shapes the sound: spaces and line ends are lower and duller. */
export function keyClick(kind: 'char' | 'space' | 'enter' = 'char') {
  if (!enabled || !ctx || !noise || ctx.state !== 'running') return
  const now = ctx.currentTime
  if (now - lastAt < 0.03) return // fast-forward: don't machine-gun
  lastAt = now

  const src = ctx.createBufferSource()
  src.buffer = noise
  src.playbackRate.value = 0.85 + Math.random() * 0.3

  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = kind === 'char' ? 2200 + Math.random() * 1400 : kind === 'space' ? 1100 : 800
  band.Q.value = 1.1

  const gain = ctx.createGain()
  const peak = (kind === 'char' ? 0.05 : 0.07) * (0.75 + Math.random() * 0.5)
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(peak, now + 0.002)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === 'enter' ? 0.09 : 0.045))

  src.connect(band).connect(gain).connect(ctx.destination)
  src.start(now)
  src.stop(now + 0.1)
}
