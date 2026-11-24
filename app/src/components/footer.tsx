import { useRef } from 'react'
import { motion } from 'motion/react'
import { CONTACT_EMAIL, LINKS } from '@/data'
import { Button, Glare } from './ui/button'
import { Magnetic } from './fx/magnetic'
import { TextRoll } from './fx/text-roll'
import { ArrowSwap } from './fx/arrow-swap'
import { NeonRing, type RingHandle } from './neon-ring'

export function Footer() {
  const ring = useRef<RingHandle>(null)
  const rise = {
    initial: { opacity: 0, y: 24, filter: 'blur(8px)' },
    whileInView: { opacity: 1, y: 0, filter: 'blur(0px)' },
    viewport: { once: true, margin: '-60px' },
  }
  return (
    <footer id="contact" className="relative flex flex-col items-center px-5 pb-12 pt-16 text-center md:pt-24">
      <motion.div {...rise} transition={{ duration: 0.9 }}>
        <NeonRing ref={ring} size={84} />
      </motion.div>
      <motion.h2
        {...rise}
        transition={{ duration: 0.8, delay: 0.1 }}
        className="mt-8 text-[36px] font-medium leading-[1.05] tracking-[-0.035em] md:text-[48px]"
      >
        Want to build something?
        <br />
        <span className="font-serif text-[1.08em] italic font-normal tracking-normal text-accent-2">Let’s talk</span>
      </motion.h2>
      <motion.div {...rise} transition={{ duration: 0.8, delay: 0.2 }} className="mt-9">
        <Magnetic>
          <Button asChild size="lg" onPointerEnter={() => ring.current?.pulse(1.6)}>
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
      <p className="mt-16 font-mono text-[10px] uppercase tracking-[0.22em] text-subtle">© 2026 Bruno Paradas</p>
    </footer>
  )
}
