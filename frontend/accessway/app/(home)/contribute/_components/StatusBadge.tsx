import { CheckCircle2, Clock, XCircle } from 'lucide-react'

import type { ContributionStatus } from '@/types/contribute'

const STYLES: Record<ContributionStatus, { label: string; icon: typeof Clock; color: string; bg: string }> = {
  pending: { label: 'In review', icon: Clock, color: 'var(--tag-yellow)', bg: 'var(--tag-yellow-bg)' },
  approved: { label: 'Approved', icon: CheckCircle2, color: 'var(--tag-green)', bg: 'var(--tag-green-bg)' },
  rejected: { label: 'Not approved', icon: XCircle, color: 'var(--tag-red)', bg: 'var(--tag-red-bg)' },
}

export function StatusBadge({ status }: { status: ContributionStatus }) {
  const { label, icon: Icon, color, bg } = STYLES[status]
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: bg }}>
      <Icon className="size-3.5" style={{ color }} aria-hidden="true" />
      {label}
    </span>
  )
}
