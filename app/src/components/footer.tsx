import { motion } from 'motion/react'
import { CONTACT_EMAIL, LINKS } from '@/data'
import { Button, Glare } from './ui/button'
import { Magnetic } from './fx/magnetic'
import { TextRoll } from './fx/text-roll'
import { ArrowSwap } from './fx/arrow-swap'

export function Footer() {
  const rise = {
    initial: { opacity: 0, y: 24, filter: 'blur(8px)' },
    whileInView: { opacity: 1, y: 0, filter: 'blur(0px)' },
    viewport: { once: true, margin: '-60px' },
  }
  return (
    <footer id="contact" className="relative flex flex-col items-center px-5 pb-12 pt-24 text-center md:pt-40">
      {/* Avatar: the intro's astronaut with Bruno's moustache and goatee, floating gently. */}
      <motion.div {...rise} transition={{ duration: 0.9 }}>
        <motion.img
          src="/images/avatar.webp"
          alt="Anime illustration of Bruno as the astronaut"
          width={112}
          height={112}
          className="size-24 rounded-full border border-line shadow-[0_0_0_6px_rgb(255_255_255/0.03),0_12px_40px_rgb(0_0_0/0.5)] md:size-28"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
      <motion.h2
        {...rise}
        transition={{ duration: 0.8, delay: 0.1 }}
        className="mt-8 text-[41px] font-normal leading-[1.1] tracking-[-0.035em] text-white md:text-[55px]"
      >
        Want to build something?
        <br />
        <span className="font-semibold">Let’s talk</span>
      </motion.h2>
      <motion.div {...rise} transition={{ duration: 0.8, delay: 0.2 }} className="mt-9">
        <Magnetic>
          <Button asChild size="lg">
            <a href={`mailto:${CONTACT_EMAIL}`}>
              <Glare />
              <TextRoll className="relative">Contact</TextRoll>
              <ArrowSwap className="relative" />
            </a>
          </Button>
        </Magnetic>
      </motion.div>
      <motion.div {...rise} transition={{ duration: 0.8, delay: 0.3 }} className="mt-6 flex gap-2">
        <Button asChild variant="ghost">
          <a href={LINKS.linkedin} target="_blank" rel="noreferrer">
            <TextRoll>LinkedIn</TextRoll>
            <ArrowSwap />
          </a>
        </Button>
        <Button asChild variant="ghost">
          <a href={LINKS.resume} target="_blank" rel="noreferrer">
            <TextRoll>Resume</TextRoll>
            <ArrowSwap />
          </a>
        </Button>
      </motion.div>
      <p className="mt-16 font-mono text-[11px] uppercase tracking-[0.22em] text-subtle">© 2026 Bruno Paradas</p>
      <p className="mt-3 text-[12px] text-subtle">
        Space illustrations:{' '}
        <a href="https://www.magnific.com/free-ai-image/anime-style-character-space_122494274.htm" target="_blank" rel="noreferrer" className="underline decoration-line underline-offset-2 hover:text-muted">
          Magnific
        </a>
      </p>
    </footer>
  )
}
