// Smooth, eased page scrolling (Lenis), like kenjilambert.com. The page keeps the real
// window scroll, so Motion's useScroll and sticky sections work unchanged.
// Off for visitors who ask for reduced motion.
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'

let lenis: Lenis | null = null

export function startSmoothScroll() {
  if (lenis || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}
  lenis = new Lenis({ autoRaf: true, lerp: 0.12, anchors: true })
  return () => {
    lenis?.destroy()
    lenis = null
  }
}

/** Freeze page scrolling (while an overlay is open) and let it go again. */
export function pauseSmoothScroll(paused: boolean) {
  if (paused) lenis?.stop()
  else lenis?.start()
}
