'use client'

import L from 'leaflet'
import { renderToStaticMarkup } from 'react-dom/server'
import { useMemo } from 'react'
import { Marker, Popup } from 'react-leaflet'

import { FEATURE_TYPES } from '@/data/FeatureTypes'
import { FEATURE_ICONS } from '@/lib/featureIcons'
import type { AccessFeature } from '@/types/features'

/**
 * Map pins, built on the rules that actually govern legibility at map scale.
 *
 *  - Solid fill, white glyph. A pale tint behind a saturated thin stroke has
 *    almost no contrast against a busy basemap; a saturated fill behind a white
 *    glyph has the most contrast available. This is why every major map does it.
 *  - Thick strokes. A 2px line inside a 16px glyph disappears once the browser
 *    downsamples it. These run at 2.6 with round caps.
 *  - Distinct silhouettes, not just distinct colours. Someone who cannot tell
 *    the green from the orange still reads the shape.
 *  - The point marks the spot. A circle centred on a doorway is ambiguous by its
 *    own radius; a pin with a stem is not.
 *  - One size step for selection, plus a ring. Size alone is easy to miss when
 *    the pin you are comparing against is off-screen.
 */

const SIZE = 32
const SELECTED_SIZE = 40

function buildIcon(type: keyof typeof FEATURE_TYPES, selected: boolean, issue: boolean, hasPhoto: boolean) {
  const { color } = FEATURE_TYPES[type]
  const Icon = FEATURE_ICONS[type]
  const size = selected ? SELECTED_SIZE : SIZE
  const glyphSize = Math.round(size * 0.55)

  const glyph = renderToStaticMarkup(<Icon width={glyphSize} height={glyphSize} stroke="#ffffff" strokeWidth={2.6} />)

  // Circular head with a stem, so the tip sits on the coordinate.
  const html = `
    <div style="position:relative;width:${size}px;height:${size + 8}px;">
      <div style="
        position:absolute;inset:0 0 8px 0;
        display:grid;place-items:center;
        border-radius:50%;
        background:${color};
        border:2.5px solid #ffffff;
        box-shadow:0 2px 5px rgb(15 15 15 / 0.35);
        ${selected ? 'outline:3px solid var(--ring);outline-offset:2px;' : ''}
      ">${glyph}</div>
      <div style="
        position:absolute;left:50%;bottom:1px;
        width:0;height:0;margin-left:-5px;
        border-left:5px solid transparent;
        border-right:5px solid transparent;
        border-top:8px solid #ffffff;
      "></div>
      ${
        issue
          ? `<div style="position:absolute;top:-2px;right:-2px;width:12px;height:12px;border-radius:50%;background:var(--tag-red);border:2px solid #ffffff;"></div>`
          : ''
      }
      ${
        hasPhoto
          ? `<div style="position:absolute;bottom:6px;right:-2px;width:12px;height:12px;border-radius:3px;background:#ffffff;border:1.5px solid ${color};display:grid;place-items:center;">
               <div style="width:5px;height:5px;border-radius:50%;background:${color};"></div>
             </div>`
          : ''
      }
    </div>`

  return L.divIcon({
    html,
    className: 'accessway-pin',
    iconSize: [size, size + 8],
    iconAnchor: [size / 2, size + 8],
    popupAnchor: [0, -(size + 4)],
  })
}

type Props = {
  feature: AccessFeature
  selected: boolean
  onSelect: (id: string) => void
  /** Community photos taken at this spot. */
  photos?: { id: string; photoUrl?: string; description?: string; name?: string }[]
}

export function FeatureMarker({ feature, selected, onSelect, photos = [] }: Props) {
  const issue = feature.status === 'reported-issue'
  const shots = [
    ...(feature.photoUrl ? [{ id: feature.id, photoUrl: feature.photoUrl, description: feature.description }] : []),
    ...photos.filter((p) => p.photoUrl),
  ]
  const hasPhoto = shots.length > 0

  const icon = useMemo(
    () => buildIcon(feature.type, selected, issue, hasPhoto),
    [feature.type, selected, issue, hasPhoto],
  )
  const { label } = FEATURE_TYPES[feature.type]

  return (
    <Marker
      position={[feature.lat, feature.lng]}
      icon={icon}
      // Screen readers get the name, not an unlabelled graphic.
      alt={`${feature.name} — ${label}`}
      keyboard
      eventHandlers={{ click: () => onSelect(feature.id) }}
    >
      <Popup minWidth={shots.length ? 232 : 180}>
        {shots.length > 0 && (
          <span className="mb-2 flex gap-1.5 overflow-x-auto">
            {shots.slice(0, 3).map((shot) => (
              // eslint-disable-next-line @next/next/no-img-element -- community upload
              <img
                key={shot.id}
                src={shot.photoUrl}
                alt={shot.description ?? `Photo of ${feature.name}`}
                className="h-28 w-36 shrink-0 rounded-lg object-cover"
              />
            ))}
          </span>
        )}
        <strong className="block text-sm">{feature.name}</strong>
        <span className="text-xs" style={{ color: 'var(--muted)' }}>
          {label}
          {issue && ' · Reported issue'}
          {shots.length > 0 && ` · ${shots.length} photo${shots.length === 1 ? '' : 's'} from the community`}
        </span>
        {feature.description && <p className="!my-1 text-sm">{feature.description}</p>}
      </Popup>
    </Marker>
  )
}
