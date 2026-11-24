import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Badge({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      data-slot="badge"
      className={cn('inline-flex h-7 items-center rounded-full border border-line px-3 text-xs text-muted', className)}
      {...props}
    />
  )
}
