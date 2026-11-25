import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Volume2, VolumeX } from 'lucide-react'
import { onSoundChange, setSoundEnabled, soundEnabled } from '@/lib/sound-pref'
import { setupMusic, unlockMusic } from '@/lib/music'

/**
 * Corner icon button for the background music. Browsers only play audio after a click or
 * key press, so the first interaction anywhere on the page unlocks it.
 */
export function SoundToggle() {
  const [on, setOn] = useState(soundEnabled)
  useEffect(() => onSoundChange(setOn), [])
  useEffect(setupMusic, [])
  useEffect(() => {
    const unlock = () => unlockMusic()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  const Icon = on ? Volume2 : VolumeX
  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1, duration: 0.6 }}
      onClick={() => setSoundEnabled(!on)}
      aria-pressed={on}
      aria-label={on ? 'Turn music off' : 'Turn music on'}
      title={on ? 'Music on' : 'Music off'}
      className="fixed bottom-4 left-4 z-50 grid size-10 place-items-center rounded-full border border-line bg-bg/70 text-muted backdrop-blur-md outline-none transition-colors hover:border-fg/25 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent-2/60"
    >
      <motion.span key={on ? 'on' : 'off'} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 22 }}>
        <Icon className="size-[18px]" strokeWidth={1.75} />
      </motion.span>
    </motion.button>
  )
}
