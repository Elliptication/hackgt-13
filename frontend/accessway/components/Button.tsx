import Link from 'next/link'
import type { ComponentProps } from 'react'

// Soft, pill-shaped buttons
const variants = {
  primary: 'bg-primary text-primary-foreground shadow-[0_2px_8px_-2px_rgb(11_107_203/0.35)] hover:bg-primary-hover',
  secondary: 'bg-primary-soft text-foreground hover:brightness-[0.97]',
  ghost: 'text-muted hover:bg-hover hover:text-foreground',
}

const sizes = {
  md: 'h-9 gap-1.5 px-4 text-sm',
  lg: 'h-11 gap-2 px-6 text-[15px]',
}

type ButtonProps = ComponentProps<typeof Link> & {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
}

export function Button({ variant = 'primary', size = 'lg', className = '', ...props }: ButtonProps) {
  return (
    <Link
      className={`inline-flex items-center justify-center rounded-full font-medium whitespace-nowrap transition duration-200 select-none motion-safe:active:scale-[0.98] ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  )
}
