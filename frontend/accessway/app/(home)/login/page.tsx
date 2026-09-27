import type { Metadata } from 'next'

import { LoginForm } from './_components/LoginForm'
import { safeNextPath } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'Log in',
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams

  return <LoginForm next={safeNextPath(next)} />
}
