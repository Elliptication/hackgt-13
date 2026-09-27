'use client'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

import { useAuth } from '@/hooks/useAuth'

/**
 * Sends someone to log in, remembering the page (and tab) they were on so
 * they land back there afterwards. The log in page links to sign up for new people.
 */
export function useLoginRedirect() {
  const router = useRouter()

  return useCallback(() => {
    const here = window.location.pathname + window.location.search
    router.push(`/login?next=${encodeURIComponent(here)}`)
  }, [router])
}

/**
 * Returns a check to call at the moment someone tries to do something that
 * needs an account (add a photo, vote). Signed in → true. Signed out → sends
 * them to log in and returns false.
 *
 * Pages themselves stay open to everyone; nothing redirects on page load.
 */
export function useRequireAuth() {
  const { user } = useAuth()
  const goToLogin = useLoginRedirect()

  return useCallback(() => {
    if (user) return true
    goToLogin()
    return false
  }, [user, goToLogin])
}
