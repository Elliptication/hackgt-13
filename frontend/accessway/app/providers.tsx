'use client'

import { AuthProvider } from '@/components/AuthProvider'
import { ContributionsProvider } from '@/components/ContributionsProvider'

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ContributionsProvider>{children}</ContributionsProvider>
    </AuthProvider>
  )
}

export default Providers
