export type FeatureType = 'ramp' | 'elevator' | 'entrance' | 'restroom' | 'other'

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
}
