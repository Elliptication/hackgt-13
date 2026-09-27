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
  /** A local object URL while the upload is in flight; the stored photo after */
  photoUrl?: string
  submittedBy: string
  submittedAt: number
  confirms: number
  rejects: number
  status: ContributionStatus
  /**
   * The row the API created for this photo, and what a vote is cast against.
   * Unset means the upload never reached the backend, so votes on it stay local.
   */
  contributionId?: string
  /** The feature the API created alongside it. */
  featureId?: string
  /**
   * The upload did not reach the API, so this photo exists on this device only.
   * The file is kept alongside it so it can be sent again.
   */
  unsent?: boolean
  file?: File | null
}

export type NewContribution = Pick<Contribution, 'type' | 'name' | 'description' | 'lat' | 'lng' | 'photoUrl'> & {
  /**
   * The photo as picked. The API needs the bytes — `photoUrl` is only an object
   * URL for the preview — so an upload without this stays on this device.
   */
  file?: File | null
}
