// Quiet background music. Browsers only allow audio after a click or key press, so it
// starts on the first interaction and follows the Sound on/off toggle.
// The track file (public/audio/background.mp3) is kept out of git; without it this is silent.
import { onSoundChange, soundEnabled } from './sound-pref'

const SRC = '/audio/background.mp3'
const VOLUME = 0.12 // quiet, in the background

let audio: HTMLAudioElement | null = null
let fade = 0
let started = false

function fadeTo(target: number, ms: number, then?: () => void) {
  if (!audio) return
  cancelAnimationFrame(fade)
  const from = audio.volume
  const t0 = performance.now()
  const step = (now: number) => {
    if (!audio) return
    const k = Math.min(1, (now - t0) / ms)
    audio.volume = from + (target - from) * k
    if (k < 1) fade = requestAnimationFrame(step)
    else then?.()
  }
  fade = requestAnimationFrame(step)
}

function play() {
  if (!audio) {
    audio = new Audio(SRC)
    audio.loop = true
    audio.volume = 0
    audio.addEventListener('error', () => (audio = null), { once: true })
  }
  audio
    .play()
    .then(() => fadeTo(VOLUME, 2500))
    .catch(() => {})
}

function pause() {
  fadeTo(0, 600, () => audio?.pause())
}

/** Call from a user gesture (click / key). */
export function startMusic() {
  if (started) return
  started = true
  if (soundEnabled()) play()
  onSoundChange((on) => (on ? play() : pause()))
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause()
    else if (soundEnabled()) play()
  })
}
