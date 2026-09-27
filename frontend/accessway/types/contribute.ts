import type { FeatureType } from '@/types/features'

export type ContributionStatus = 'pending' | 'approved' | 'rejected'

export type Vote = 'confirm' | 'reject'

export type Contribution = {
  id: string
  type: FeatureType
  name: string
  /** Also used as the photo's alt text */
  description: string
  lat: number
  lng: number
  /** Object URL for now; a real upload URL once there's a backend */
  photoUrl?: string
  submittedBy: string
  submittedAt: number
  confirms: number
  rejects: number
  status: ContributionStatus
}

export type NewContribution = Pick<Contribution, 'type' | 'name' | 'description' | 'lat' | 'lng' | 'photoUrl'>
