'use client'

import { useState } from 'react'

import { AuthCard } from './AuthCard'
import { GOOGLE_LOGIN_URL, googleLoginHref } from '@/lib/auth'
import { REWARD_CENTS } from '@/lib/constants'

/**
 * Google is the only way in, and it covers signing up too: a first Google
 * sign-in creates the account. Where the button goes is set in lib/auth.ts.
 */
export function LoginForm({ next }: { next: string }) {
  const [notReady, setNotReady] = useState(false)

  function continueWithGoogle() {
    if (!GOOGLE_LOGIN_URL) {
      console.warn('Google login is not set up: fill in GOOGLE_LOGIN_URL in lib/auth.ts.')
      setNotReady(true)
      return
    }
    window.location.assign(googleLoginHref(next))
  }

  return (
    <AuthCard
      title="Log in"
      subtitle={`Add photos, check others’ photos, and earn ${REWARD_CENTS}¢ for every one that’s approved.`}
      footer="New here? Signing in with Google sets up your account."
    >
      {notReady && (
        <p role="alert" className="mb-4 rounded-xl bg-[var(--tag-red-bg)] px-3.5 py-2.5 text-sm">
          Google login isn’t set up yet. Try again later.
        </p>
      )}

      <button
        type="button"
        onClick={continueWithGoogle}
        className="flex h-11 w-full items-center justify-center gap-3 rounded-full bg-background text-[15px] font-medium ring-1 ring-border transition hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <GoogleMark />
        Continue with Google
      </button>
    </AuthCard>
  )
}

/** Google's "G", as its sign-in button guidelines ask for. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}
