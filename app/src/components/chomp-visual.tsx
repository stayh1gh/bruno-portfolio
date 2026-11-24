import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

const STEPS = ['Plan', 'Figma', 'Build', 'PR'] as const

/** Placeholder "video" for the Chomp card, made in code: a task walks Plan → Figma → Build → PR. */
export function ChompVisual() {
  const reduce = useReducedMotion()
  const [step, setStep] = useState(reduce ? STEPS.length - 1 : 0)
  useEffect(() => {
    if (reduce) return
    const id = setInterval(() => setStep((s) => (s + 1) % (STEPS.length + 1)), 1100)
    return () => clearInterval(id)
  }, [reduce])
  const at = Math.min(step, STEPS.length - 1)

  return (
    <div
      className="relative flex size-full flex-col items-center justify-center gap-7 overflow-hidden"
      style={{
        backgroundImage: 'radial-gradient(color-mix(in oklab, var(--fg) 12%, transparent) 1px, transparent 1px)',
        backgroundSize: '18px 18px',
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_50%,transparent,var(--bg))]" />
      <div className="relative flex items-center">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center">
            <motion.div
              animate={{ scale: i === at && step < STEPS.length ? 1.08 : 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18 }}
              className={cn(
                'rounded-full border px-3 py-1.5 font-mono text-[11px] transition-colors duration-500',
                i <= at && step < STEPS.length ? 'border-accent-2/50 bg-accent-2/15 text-accent-2' : 'border-line text-subtle',
              )}
            >
              {s}
            </motion.div>
            {i < STEPS.length - 1 && (
              <div className="relative mx-1.5 h-px w-5 bg-line md:w-7">
                <motion.div
                  className="absolute inset-0 origin-left bg-accent-2"
                  animate={{ scaleX: i < at && step < STEPS.length ? 1 : 0 }}
                  transition={{ duration: 0.5, ease: [0.7, 0, 0.2, 1] }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="relative font-mono text-[10px] uppercase tracking-[0.2em] text-subtle">
        {step >= STEPS.length - 1 ? 'draft PR opened' : 'agent working…'}
      </p>
    </div>
  )
}
