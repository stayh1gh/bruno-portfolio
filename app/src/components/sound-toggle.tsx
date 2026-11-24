import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { onSoundChange, setSoundEnabled, soundEnabled, unlockAudio } from '@/lib/typing-sound'
import { cn } from '@/lib/utils'
import { startMusic } from '@/lib/music'

/**
 * Corner toggle for sound: typing clicks and the background music. Browsers only play audio after a click or key press,
 * so the first interaction anywhere on the page unlocks it.
 */
export function SoundToggle() {
  const [on, setOn] = useState(soundEnabled)
  useEffect(() => onSoundChange(setOn), [])
  useEffect(() => {
    const unlock = () => {
      unlockAudio()
      startMusic()
    }
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1, duration: 0.6 }}
      onClick={() => setSoundEnabled(!on)}
      aria-pressed={on}
      aria-label={on ? 'Turn typing sound off' : 'Turn typing sound on'}
      className="group/roll fixed bottom-4 left-4 z-50 flex h-8 items-center gap-2 rounded-full border border-line bg-bg/80 px-3 text-[12px] text-subtle backdrop-blur-md outline-none transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-accent-2/60"
    >
      <span aria-hidden className="flex h-3 items-end gap-[2px]">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn('w-[2px] origin-bottom rounded-full bg-current transition-[height] duration-300', on ? 'h-3' : 'h-[2px]')}
            style={on ? { animation: `eq 0.9s ${i * 0.13}s ease-in-out infinite alternate` } : undefined}
          />
        ))}
      </span>
      <span className="max-md:sr-only">Sound {on ? 'on' : 'off'}</span>
    </motion.button>
  )
}
