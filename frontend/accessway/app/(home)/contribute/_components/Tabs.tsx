'use client'

import { Camera, CheckCheck } from 'lucide-react'
import Link from 'next/link'

import { useContributions } from '@/hooks/useContributions'

export type ContributeTab = 'add' | 'review'

export function Tabs({ active }: { active: ContributeTab }) {
  const { contributions, userId, myVotes } = useContributions()
  const toReview = contributions.filter(
    (c) => c.status === 'pending' && c.submittedBy !== userId && !myVotes[c.id],
  ).length

  const tabs = [
    { id: 'add' as const, label: 'Add a photo', icon: Camera },
    { id: 'review' as const, label: 'Review photos', icon: CheckCheck, count: toReview },
  ]

  return (
    <nav aria-label="Contribute" className="mt-10 flex gap-1 rounded-full bg-hover p-1 sm:w-fit">
      {tabs.map(({ id, label, icon: Icon, count }) => {
        const selected = id === active
        return (
          <Link
            key={id}
            href={`/contribute?tab=${id}`}
            scroll={false}
            aria-current={selected ? 'page' : undefined}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap transition sm:flex-none sm:gap-2 sm:px-4 ${
              selected ? 'bg-background shadow-[0_1px_3px_rgb(15_15_15/0.1)]' : 'text-muted hover:text-foreground'
            }`}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
            {!!count && (
              <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                {count}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
