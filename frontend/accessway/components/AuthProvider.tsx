'use client'

import { createContext, useCallback, useMemo, useState } from 'react'

import type { AuthResult, User } from '@/types/auth'

type AuthContextValue = {
  user: User | null
  /** Whether an account already exists for this email */
  hasAccount: (email: string) => boolean
  signUp: (input: { name: string; email: string; password: string }) => AuthResult
  logIn: (input: { email: string; password: string }) => AuthResult
  logOut: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

type StoredUser = User & { password: string }

/**
 * DEMO ONLY: accounts live in memory and reset on page reload, and passwords
 * are kept in plain text. Swap this for a real auth provider (e.g. Supabase Auth)
 * before anyone uses it for real.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<StoredUser[]>([])
  const [user, setUser] = useState<User | null>(null)

  const signUp = useCallback<AuthContextValue['signUp']>(
    ({ name, email, password }) => {
      const normalized = email.trim().toLowerCase()
      if (users.some((u) => u.email === normalized)) {
        return { error: 'There’s already an account with that email. Try logging in.' }
      }
      const created: StoredUser = { id: crypto.randomUUID(), name: name.trim(), email: normalized, password }
      setUsers((prev) => [...prev, created])
      setUser({ id: created.id, name: created.name, email: created.email })
      return {}
    },
    [users],
  )

  const logIn = useCallback<AuthContextValue['logIn']>(
    ({ email, password }) => {
      const found = users.find((u) => u.email === email.trim().toLowerCase())
      if (!found || found.password !== password) return { error: 'That email and password don’t match.' }
      setUser({ id: found.id, name: found.name, email: found.email })
      return {}
    },
    [users],
  )

  const hasAccount = useCallback(
    (email: string) => users.some((u) => u.email === email.trim().toLowerCase()),
    [users],
  )

  const logOut = useCallback(() => setUser(null), [])

  const value = useMemo(
    () => ({ user, hasAccount, signUp, logIn, logOut }),
    [user, hasAccount, signUp, logIn, logOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
