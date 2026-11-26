import { motion } from 'motion/react'
import { CONTACT_EMAIL, STATEMENT } from '@/data'
import { Button } from './ui/button'
import { TextRoll } from './fx/text-roll'
import { ArrowSwap } from './fx/arrow-swap'

/**
 * A quiet pause between the astronaut and the projects: a narrow column of text with a lot of
 * room around it (after shaahid.in), where some phrases step back in grey. Text only: the space
 * background shows around it.
 */
export function Statement() {
  const rise = (delay: number) => ({
    initial: { opacity: 0, y: 20, filter: 'blur(6px)' },
    whileInView: { opacity: 1, y: 0, filter: 'blur(0px)' },
    viewport: { once: true, margin: '-15% 0px' },
    transition: { duration: 0.8, delay, ease: [0.2, 0.7, 0.2, 1] as const },
  })

  return (
    <section aria-label="How I work" className="relative mx-auto flex min-h-svh w-full max-w-[2200px] items-center justify-center px-5 py-28 md:px-8 md:py-40 xl:px-24">
      <div className="mx-auto flex max-w-[29rem] flex-col gap-5 text-[19px] font-medium leading-[1.6] tracking-[-0.01em] text-fg md:text-[21px]">
        {STATEMENT.map((paragraph, i) => (
          <motion.p key={i} {...rise(i * 0.12)} className="[text-wrap:pretty]">
            {paragraph.map((seg, j) => (
              <span key={j} className={seg.quiet ? 'text-subtle' : undefined}>
                {seg.t}
              </span>
            ))}
          </motion.p>
        ))}
        <motion.div {...rise(0.3)} className="mt-3 flex justify-center">
          <Button asChild variant="outline" size="sm">
            <a href={`mailto:${CONTACT_EMAIL}`}>
              <TextRoll>Get in touch</TextRoll>
              <ArrowSwap />
            </a>
          </Button>
        </motion.div>
      </div>
    </section>
  )
}
