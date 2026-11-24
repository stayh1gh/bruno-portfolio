import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  [
    'group/roll relative isolate inline-flex shrink-0 items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-full font-medium outline-none select-none',
    'transition-[background-color,color,border-color,transform,box-shadow] duration-300 active:scale-[0.96]',
    'focus-visible:ring-2 focus-visible:ring-accent-2/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
    'disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-fg text-bg hover:shadow-[0_0_0_4px_color-mix(in_oklab,var(--fg)_14%,transparent),0_8px_30px_-6px_color-mix(in_oklab,var(--accent-2)_55%,transparent)]',
        accent: 'bg-accent text-accent-fg hover:shadow-[0_8px_30px_-6px_var(--accent)]',
        outline: 'border border-line bg-transparent text-fg hover:border-fg/25 hover:bg-fg/[0.04]',
        ghost: 'text-muted hover:text-fg',
      },
      size: {
        sm: 'h-8 px-3.5 text-[13px]',
        md: 'h-9 px-4 text-sm',
        lg: 'h-11 px-5 text-[15px]',
        icon: 'size-8 rounded-lg',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

type ButtonProps = ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }

/** shadcn-style Button. Solid variants get a glare that sweeps across on hover. */
export function Button({ className, variant, size, asChild = false, children, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  const glare = variant === undefined || variant === 'primary' || variant === 'accent'
  return (
    <Comp data-slot="button" className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {asChild ? (
        children
      ) : (
        <>
          {glare && <Glare />}
          {children}
        </>
      )}
    </Comp>
  )
}

export function Glare() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-y-0 -left-1/2 -z-0 w-1/3 -translate-x-full -skew-x-[20deg] bg-gradient-to-r from-transparent via-white/70 to-transparent opacity-0 transition-[transform,opacity] duration-[750ms] ease-out group-hover/roll:translate-x-[520%] group-hover/roll:opacity-100"
    />
  )
}

export { buttonVariants }
