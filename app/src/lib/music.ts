// Quiet background music from the first screen. Browsers only allow audio after a click,
// tap or key press (scrolling doesn't count), so it starts on the visitor's first
// interaction. It follows the corner music toggle.
// The track file (public/audio/background.mp3) is kept out of git; without it this is silent.
import { onSoundChange, soundEnabled } from './sound-pref'

const SRC = '/audio/background.mp3'
const VOLUME = 0.08 // quiet, in the background
const START = 23 // seconds into the track

let audio: HTMLAudioElement | null = null
let fade = 0
let unlocked = false // the visitor has clicked / tapped / pressed a key

function fadeTo(target: number, ms: number, then?: () => void) {
  if (!audio) return
  cancelAnimationFrame(fade)
  const from = audio.volume
  const t0 = performance.now()
  const step = (now: number) => {
    if (!audio) return
    const k = Math.min(1, (now - t0) / ms)
    audio.volume = Math.min(1, Math.max(0, from + (target - from) * k))
    if (k < 1) fade = requestAnimationFrame(step)
    else then?.()
  }
  fade = requestAnimationFrame(step)
}

function play() {
  if (!unlocked || !soundEnabled() || document.hidden) return
  if (!audio) {
    // Starts at 0:23, and loops back to 0:23 rather than the beginning.
    const a = new Audio(`${SRC}#t=${START}`)
    a.volume = 0
    a.addEventListener('ended', () => {
      a.currentTime = START
      void a.play().catch(() => {})
    })
    a.addEventListener('error', () => (audio = null), { once: true })
    audio = a
  }
  audio
    .play()
    .then(() => fadeTo(VOLUME, 2500))
    .catch(() => {})
}

function pause() {
  fadeTo(0, 600, () => audio?.pause())
}

/** Call from a user gesture (click / key): audio is allowed from now on. */
export function unlockMusic() {
  unlocked = true
  play()
}

/** Wire up the triggers once: the toggle and tab visibility. */
export function setupMusic() {
  const offToggle = onSoundChange((on) => (on ? play() : pause()))
  const onVis = () => (document.hidden ? pause() : play())
  document.addEventListener('visibilitychange', onVis)
  return () => {
    offToggle()
    document.removeEventListener('visibilitychange', onVis)
  }
}
