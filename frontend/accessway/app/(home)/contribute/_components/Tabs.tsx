'use client'

import { Camera, CheckCheck } from 'lucide-react'
import Link from 'next/link'


export type ContributeTab = 'add' | 'review'

export function Tabs({ active }: { active: ContributeTab }) {
  // No count on the review tab. It used to be the length of the sample list,
  // which is gone; the real number lives behind `/features` and fetching it here
  // would mean a second request for the same rows the queue already asks for.
  // Better nothing than a number that is not true.
  const tabs = [
    { id: 'add' as const, label: 'Add a photo', icon: Camera },
    { id: 'review' as const, label: 'Review photos', icon: CheckCheck },
  ]

  return (
    <nav aria-label="Contribute" className="mt-10 flex gap-1 rounded-full bg-hover p-1 sm:w-fit">
      {tabs.map(({ id, label, icon: Icon }) => {
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
          </Link>
        )
      })}
    </nav>
  )
}
