import type { Metadata } from 'next'

import { Header } from '@/components/Header'

export const metadata: Metadata = {
  title: 'Map',
}

export default function MapLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main id="main" tabIndex={-1} className="h-dvh pt-14 outline-hidden">
        {children}
      </main>
    </>
  )
}
