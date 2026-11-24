import { ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/** The arrow flies out to the top-right and a new one slides in from the bottom-left. */
export function ArrowSwap({ className }: { className?: string }) {
  const t = 'absolute inset-0 transition-transform duration-[480ms] ease-[cubic-bezier(.7,0,.2,1)]'
  return (
    <span aria-hidden className={cn('relative inline-block size-4 overflow-hidden', className)}>
      <ArrowUpRight className={cn(t, 'size-full group-hover/roll:translate-x-full group-hover/roll:-translate-y-full')} />
      <ArrowUpRight className={cn(t, 'size-full -translate-x-full translate-y-full group-hover/roll:translate-x-0 group-hover/roll:translate-y-0')} />
    </span>
  )
}
