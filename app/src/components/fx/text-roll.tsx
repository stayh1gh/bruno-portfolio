import { cn } from '@/lib/utils'

/**
 * Letters roll up and a copy rolls in from below, staggered, when any ancestor with
 * the `group/roll` class is hovered or focused.
 */
export function TextRoll({ children, className }: { children: string; className?: string }) {
  const chars = [...children]
  const ease = 'transition-transform duration-[520ms] ease-[cubic-bezier(.7,0,.2,1)]'
  return (
    <span className={cn('relative inline-flex overflow-hidden leading-[1.2]', className)}>
      <span className="sr-only">{children}</span>
      <span aria-hidden className="flex">
        {chars.map((c, i) => (
          <span
            key={i}
            className={cn(ease, 'inline-block group-hover/roll:-translate-y-full group-focus-visible/roll:-translate-y-full')}
            style={{ transitionDelay: `${i * 16}ms` }}
          >
            {c === ' ' ? ' ' : c}
          </span>
        ))}
      </span>
      <span aria-hidden className="absolute inset-0 flex">
        {chars.map((c, i) => (
          <span
            key={i}
            className={cn(ease, 'inline-block translate-y-full group-hover/roll:translate-y-0 group-focus-visible/roll:translate-y-0')}
            style={{ transitionDelay: `${i * 16}ms` }}
          >
            {c === ' ' ? ' ' : c}
          </span>
        ))}
      </span>
    </span>
  )
}
