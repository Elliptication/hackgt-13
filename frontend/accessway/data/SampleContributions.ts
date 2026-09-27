import type { Contribution } from '@/types/contribute'

/**
 * SAMPLE DATA — pretend photos from other users, waiting for review,
 * so the Review page has something in it. They have no real image,
 * so a placeholder is shown instead. Replace with data from your backend.
 */
export const SAMPLE_CONTRIBUTIONS: Contribution[] = [
  {
    id: 's1',
    type: 'ramp',
    name: 'Clough Commons side ramp',
    lat: 33.7747,
    lng: -84.3964,
    submittedBy: 'user-ana',
    submittedAt: Date.parse('2026-09-25T14:10:00Z'),
    confirms: 2,
    rejects: 0,
    status: 'pending',
  },
  {
    id: 's2',
    type: 'elevator',
    name: 'Van Leer elevator',
    lat: 33.7759,
    lng: -84.3973,
    submittedBy: 'user-marcus',
    submittedAt: Date.parse('2026-09-25T16:42:00Z'),
    confirms: 1,
    rejects: 1,
    status: 'pending',
  },
  {
    id: 's3',
    type: 'accessible_entrance',
    name: 'Bobby Dodd Stadium gate 3',
    lat: 33.7724,
    lng: -84.3928,
    submittedBy: 'user-priya',
    submittedAt: Date.parse('2026-09-25T18:05:00Z'),
    confirms: 0,
    rejects: 0,
    status: 'pending',
  },
]
