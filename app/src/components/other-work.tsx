import { motion } from 'motion/react'
import { OTHER_WORK } from '@/data'

export function OtherWork() {
  return (
    <div className="pt-6 md:pt-2">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
        className="text-[46px] font-normal leading-none tracking-[-0.035em] text-white md:text-[64px]"
      >
        Other <span className="font-semibold">work</span>
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.6 }}
        className="mt-5 max-w-[560px] text-xl text-muted"
      >
        Smaller projects, explorations and screens that didn’t get a card.
      </motion.p>
      <div className="mt-12 columns-1 gap-5 md:columns-2">
        {OTHER_WORK.map((w, i) => (
          <motion.figure
            key={w.title}
            initial={{ opacity: 0, y: 40, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ delay: 0.25 + i * 0.07, duration: 0.8, ease: [0.2, 0.7, 0.2, 1] }}
            className="group/fig mb-5 break-inside-avoid"
          >
            <div className="overflow-hidden rounded-[16px] border border-line bg-card">
              <img
                src={w.src}
                alt={w.title}
                loading="lazy"
                className="w-full transition-transform duration-[1.2s] ease-[cubic-bezier(.2,.7,.2,1)] group-hover/fig:scale-[1.035]"
              />
            </div>
            <figcaption className="mt-3 text-base text-muted transition-colors group-hover/fig:text-fg">{w.title}</figcaption>
          </motion.figure>
        ))}
      </div>
    </div>
  )
}
