export type FeatureType = 'ramp' | 'elevator' | 'accessible_entrance' | 'restroom' | 'other'

export type AccessFeature = {
  id: string
  type: FeatureType
  name: string
  description?: string
  lat: number
  lng: number
  /** e.g. an elevator reported out of service */
  status?: 'working' | 'reported-issue'
  /** Community photo, if one was approved */
  photoUrl?: string
  /**
   * Set while a community report is still unconfirmed: how many people have
   * said it's really there, and how many it takes to confirm it. The marker is
   * drawn faint and fills in as yes votes arrive. Unset = confirmed or surveyed.
   */
  report?: { yes: number; needed: number }
}
