'use client'

import { createContext, useCallback, useEffect, useMemo, useState } from 'react'

import { CURRENT_USER_URL, LOGOUT_URL } from '@/lib/auth'
import type { User } from '@/types/auth'

type AuthContextValue = {
  user: User | null
  /** True while we're still asking the backend who is signed in. */
  loading: boolean
  logOut: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Who is signed in, as far as the backend's session says.
 *
 * Signing in happens entirely on the backend via Google (see lib/auth.ts), so
 * all this does is ask CURRENT_USER_URL once on load. Until that's filled in,
 * everyone is simply signed out.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!CURRENT_USER_URL) return
    let cancelled = false

    fetch(CURRENT_USER_URL, { credentials: 'include' })
      .then((res) => (res.ok ? (res.json() as Promise<User>) : null))
      .catch(() => null)
      .then((found) => {
        if (cancelled) return
        setUser(found)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const logOut = useCallback(() => {
    setUser(null)
    if (LOGOUT_URL) fetch(LOGOUT_URL, { method: 'POST', credentials: 'include' }).catch(() => {})
  }, [])

  const value = useMemo(() => ({ user, loading, logOut }), [user, loading, logOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
