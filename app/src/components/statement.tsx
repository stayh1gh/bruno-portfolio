import { useRef } from 'react'
import { motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { CONTACT_EMAIL, STATEMENT } from '@/data'
import { Button } from './ui/button'
import { TextRoll } from './fx/text-roll'
import { ArrowSwap } from './fx/arrow-swap'
import { DotTransit } from './dot-transit'

/**
 * A quiet pause between the astronaut and the projects: a narrow column of text with a lot of
 * room around it (after shaahid.in), where some phrases step back in grey.
 *
 * The text is brought in by the dots (dot-transit.tsx): they fly over from the astronaut, gather,
 * expand onto the text's lines, and the text appears as they fade (`reveal`). With reduced motion
 * the text is simply there.
 */
export function Statement() {
  const reduce = !!useReducedMotion()
  const blockRef = useRef<HTMLDivElement>(null)
  const reveal = useMotionValue(reduce ? 1 : 0)
  const blur = useTransform(reveal, (v) => `blur(${((1 - v) * 8).toFixed(2)}px)`)

  return (
    <section aria-label="How I work" className="relative mx-auto flex min-h-svh w-full max-w-[2200px] items-center justify-center px-5 py-28 md:px-8 md:py-40 xl:px-24">
      {!reduce && <DotTransit blockRef={blockRef} reveal={reveal} />}
      <motion.div
        ref={blockRef}
        style={{ opacity: reveal, filter: blur }}
        className="mx-auto flex max-w-[29rem] flex-col gap-5 text-[19px] font-medium leading-[1.6] tracking-[-0.01em] text-fg md:text-[21px]"
      >
        {STATEMENT.map((paragraph, i) => (
          <p key={i} className="[text-wrap:pretty]">
            {paragraph.map((seg, j) => (
              <span key={j} className={seg.quiet ? 'text-subtle' : undefined}>
                {seg.t}
              </span>
            ))}
          </p>
        ))}
        <div className="mt-3 flex justify-center">
          <Button asChild variant="outline" size="sm">
            <a href={`mailto:${CONTACT_EMAIL}`}>
              <TextRoll>Get in touch</TextRoll>
              <ArrowSwap />
            </a>
          </Button>
        </div>
      </motion.div>
    </section>
  )
}
