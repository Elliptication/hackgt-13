'use client'

import { LogIn } from 'lucide-react'

import { useLoginRedirect } from '@/hooks/useRequireAuth'

const variants = {
  primary: 'bg-primary text-primary-foreground shadow-[0_2px_8px_-2px_rgb(11_107_203/0.35)] hover:bg-primary-hover',
  soft: 'bg-primary-soft text-foreground hover:brightness-[0.97]',
}

/**
 * "Log in to …" call to action shown in place of actions that need an account.
 * Takes you to log in and brings you back to this page afterwards.
 */
export function LoginButton({
  children,
  variant = 'primary',
  className = '',
}: {
  children: React.ReactNode
  variant?: keyof typeof variants
  className?: string
}) {
  const goToLogin = useLoginRedirect()

  return (
    <button
      type="button"
      onClick={goToLogin}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-medium whitespace-nowrap transition motion-safe:active:scale-[0.98] ${variants[variant]} ${className}`}
    >
      <LogIn className="size-4" aria-hidden="true" />
      {children}
    </button>
  )
}
