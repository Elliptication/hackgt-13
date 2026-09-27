'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Accessibility } from 'lucide-react'

import { Button } from '@/components/Button'
import { UserMenu } from '@/components/Header/UserMenu'
import { useAuth } from '@/hooks/useAuth'
import { APP_NAME } from '@/lib/constants'

export function Header() {
  const pathname = usePathname()
  const { user } = useAuth()

  const onMap = pathname.startsWith('/map')
  const onAuthPage = pathname.startsWith('/login')

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
        <Link href="/" className="-ml-2 flex items-center gap-2 rounded-full px-2 py-1 font-[family-name:var(--font-display)] text-[17px] font-bold hover:bg-hover">
          <span className="grid size-7 place-items-center rounded-full bg-primary-soft text-primary">
            <Accessibility className="size-4" aria-hidden="true" />
          </span>
          <span className="max-[380px]:sr-only">{APP_NAME}</span>
        </Link>

        <nav aria-label="Main" className="flex items-center gap-5">
          {user ? (
            <UserMenu user={user} />
          ) : (
            !onAuthPage && (
              <Button href="/login" variant="ghost" size="md">
                Log in
              </Button>
            )
          )}
          {onMap ? (
            <Button href="/contribute" size="md">
              Contribute
            </Button>
          ) : (
            <Button href="/map" size="md">
              Open map
            </Button>
          )}
        </nav>
      </div>
    </header>
  )
}
