import type { AccessFeature } from '@/lib/features'

export const SAMPLE_FEATURES: AccessFeature[] = [
  {
    id: 'f1',
    type: 'elevator',
    name: 'F',
    description: 'Serves all floors, near the main stairs.',
    lat: 33.7738,
    lng: -84.3988,
    status: 'working',
  },
  {
    id: 'f2',
    type: 'ramp',
    name: 'E',
    description: 'Gentle slope from Ferst Dr to the lawn.',
    lat: 33.7746,
    lng: -84.3976,
  },
  {
    id: 'f3',
    type: 'entrance',
    name: 'D',
    description: 'Automatic doors with push button.',
    lat: 33.7743,
    lng: -84.3957,
  },
  {
    id: 'f4',
    type: 'restroom',
    name: 'C',
    description: 'Ground floor, single-occupancy.',
    lat: 33.7771,
    lng: -84.3962,
  },
  {
    id: 'f5',
    type: 'elevator',
    name: 'B',
    description: 'Reported out of service.',
    lat: 33.7757,
    lng: -84.4035,
    status: 'reported-issue',
  },
  {
    id: 'f6',
    type: 'ramp',
    name: 'A',
    lat: 33.7735,
    lng: -84.3958,
  },
]
