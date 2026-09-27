'use client'

import { LogOut } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

import { useAuth } from '@/hooks/useAuth'
import type { User } from '@/types/auth'

export function UserMenu({ user }: { user: User }) {
  const { logOut } = useAuth()
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const wrapper = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointer(e: PointerEvent) {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        button.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapper} className="relative ml-1">
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Account: ${user.name}`}
        className="grid size-9 place-items-center rounded-full bg-[var(--tag-purple-bg)] font-[family-name:var(--font-display)] font-bold hover:brightness-[0.97]"
      >
        {user.name.charAt(0).toUpperCase()}
      </button>

      {open && (
        <div
          id={menuId}
          className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl bg-background p-1.5 shadow-[0_8px_30px_-12px_rgb(15_15_15/0.25)] ring-1 ring-border"
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              logOut()
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-hover"
          >
            <LogOut className="size-4 text-muted" aria-hidden="true" />
            Log out
          </button>
        </div>
      )}
    </div>
  )
}
