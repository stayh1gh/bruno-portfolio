/**
 * The page background, like the dot-portrait reference: a plain, cold blue-black with a
 * fine film grain on top. The grain is an SVG noise texture (cold white specks, contrast raised so
 * it still shows on the near-black), fixed to the screen, that jumps
 * between a few positions (like film) so it feels alive without drawing attention.
 */
export const SPACE_BOTTOM = '#06080c'

const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.86 0 0 0 0 0.92 0 0 0 0 1 2.4 0 0 0 -0.95'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

export function SpaceBackdrop() {
  return (
    <>
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{ background: SPACE_BOTTOM }} />
      <div aria-hidden className="pointer-events-none fixed -inset-[50%] -z-10 opacity-[0.13] motion-safe:animate-[grain_0.9s_steps(6)_infinite]" style={{ backgroundImage: NOISE }} />
    </>
  )
}
