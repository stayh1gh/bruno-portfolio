// The visitor's Sound on/off choice (the corner toggle), remembered across visits.
// Background music (music.ts) follows it.

let enabled = readPref()
const listeners = new Set<(on: boolean) => void>()

function readPref() {
  try {
    return localStorage.getItem('sound') !== 'off'
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
    localStorage.setItem('sound', on ? 'on' : 'off')
  } catch {
    /* storage blocked */
  }
  listeners.forEach((l) => l(on))
}

export function onSoundChange(fn: (on: boolean) => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
