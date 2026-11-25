import { Galaxy } from './galaxy'

/**
 * The space behind the whole page: one tall, calm dark space painting (generated with
 * Magnific from its watercolor galaxy set, with a gradual fade baked in) that scrolls with the page. It's lightest at the top and
 * gets darker as you go down, so the last section sits on near-black with a few stars.
 * Past the bottom of the painting the page continues in its darkest colour.
 *
 * On top, a fixed layer of twinkling stars and the occasional comet keeps it alive
 * wherever you are on the page.
 */
export const SPACE_BOTTOM = '#050509'

export function SpaceBackdrop() {
  return (
    <>
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" style={{ background: SPACE_BOTTOM }}>
        <img
          src="/images/story/space-long.webp"
          srcSet="/images/story/space-long-800.webp 800w, /images/story/space-long.webp 1440w"
          sizes="100vw"
          alt=""
          className="block h-auto w-full select-none"
          draggable={false}
        />
        {/* From the work section down the sky gets much darker, so the cards sit on quiet black.
            The intro is 150svh tall; the fade starts just before it ends. */}
        <div
          className="absolute inset-x-0 bottom-0 top-[120svh]"
          style={{ background: 'linear-gradient(to bottom, rgb(5 5 9 / 0) 0, rgb(5 5 9 / 0.7) 60svh, rgb(5 5 9 / 0.85) 100%)' }}
        />
      </div>
      <Galaxy overlay className="pointer-events-none fixed inset-0 -z-10 size-full" />
    </>
  )
}
