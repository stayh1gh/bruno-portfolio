import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

const PALETTES = [
  { id: 'blue-yellow', label: 'Blue + yellow', swatch: ['#8fb4ff', '#ffd23f'] },
  { id: 'blues', label: 'Blues', swatch: ['#b9d5ff', '#5b86ff'] },
] as const
type PaletteId = (typeof PALETTES)[number]['id']

function initial(): PaletteId {
  const q = new URLSearchParams(location.search).get('palette')
  if (q === 'blues' || q === 'blue-yellow') return q
  try {
    const s = localStorage.getItem('palette')
    if (s === 'blues' || s === 'blue-yellow') return s
  } catch {
    /* storage blocked */
  }
  return 'blue-yellow'
}

/** Review-only switch so Bruno can compare the two palettes on the real page. */
export function PaletteSwitch() {
  const [palette, setPalette] = useState<PaletteId>(initial)
  useEffect(() => {
    document.documentElement.dataset.palette = palette
    try {
      localStorage.setItem('palette', palette)
    } catch {
      /* storage blocked */
    }
  }, [palette])

  return (
    <div aria-label="Palette (review only)" role="group" className="fixed bottom-4 left-4 z-50 flex items-center gap-1 rounded-full border border-line bg-bg/80 p-1 backdrop-blur-md">
      {PALETTES.map((p) => (
        <button
          key={p.id}
          onClick={() => setPalette(p.id)}
          aria-pressed={palette === p.id}
          className={cn('relative flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] transition-colors', palette === p.id ? 'text-fg' : 'text-subtle hover:text-muted')}
        >
          {palette === p.id && <motion.span layoutId="palette-pill" className="absolute inset-0 rounded-full bg-fg/10" />}
          <span className="relative flex -space-x-1">
            {p.swatch.map((c) => (
              <span key={c} className="size-2.5 rounded-full ring-1 ring-bg" style={{ background: c }} />
            ))}
          </span>
          <span className="relative max-md:sr-only">{p.label}</span>
        </button>
      ))}
    </div>
  )
}
