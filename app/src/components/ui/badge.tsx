import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Badge({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      data-slot="badge"
      className={cn('inline-flex h-[26px] items-center rounded-full border border-line px-3 text-[13px] font-medium leading-none text-muted', className)}
      {...props}
    />
  )
}
