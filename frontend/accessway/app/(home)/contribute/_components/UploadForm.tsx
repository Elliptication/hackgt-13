'use client'

/* eslint-disable @next/next/no-img-element -- previewing a local file */
import { Camera, LocateFixed, Loader2, MapPin, RefreshCw } from 'lucide-react'
import { useId, useRef, useState } from 'react'

import { DEFAULT_LOCATION, LocationPicker, type LatLng } from './LocationPicker'
import { useContributions } from '@/hooks/useContributions'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { FEATURE_TYPES } from '@/data/FeatureTypes'
import { REWARD_CENTS } from '@/lib/constants'
import type { FeatureType } from '@/types/features'

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
const TYPES: FeatureType[] = ['ramp', 'elevator', 'entrance', 'restroom', 'other']

type Errors = Partial<Record<'photo' | 'name' | 'description' | 'location', string>>

export function UploadForm() {
  const { submit, userId } = useContributions()
  // Anyone can look at the form; picking a photo or submitting asks you to sign up first
  const requireAuth = useRequireAuth()
  const id = useId()
  const fileInput = useRef<HTMLInputElement>(null)

  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [type, setType] = useState<FeatureType>('ramp')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState<LatLng | null>(null)
  const [mapCenter, setMapCenter] = useState<LatLng>(DEFAULT_LOCATION)
  const [locating, setLocating] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [justSubmitted, setJustSubmitted] = useState(false)

  function pickFile(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setErrors((e) => ({ ...e, photo: 'That file isn’t an image. Try a JPG, PNG, or HEIC photo.' }))
      return
    }
    if (file.size > MAX_BYTES) {
      setErrors((e) => ({ ...e, photo: 'That photo is over 10 MB. Try a smaller one.' }))
      return
    }
    setPhotoUrl(URL.createObjectURL(file))
    setErrors((e) => ({ ...e, photo: undefined }))
    setJustSubmitted(false)
  }

  function locateMe() {
    if (!navigator.geolocation) {
      setErrors((e) => ({ ...e, location: 'Your browser can’t share location. Tap the map instead.' }))
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setLocation(here)
        setMapCenter(here)
        setErrors((e) => ({ ...e, location: undefined }))
        setLocating(false)
      },
      () => {
        setErrors((e) => ({ ...e, location: 'Couldn’t get your location. Tap the map instead.' }))
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!requireAuth()) return
    const next: Errors = {}
    if (!photoUrl) next.photo = 'Add a photo first.'
    if (!name.trim()) next.name = 'Give this spot a short name.'
    if (!description.trim()) next.description = 'Add a quick description.'
    if (!location) next.location = 'Tap the map to mark where this is.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    submit({ type, name: name.trim(), description: description.trim(), lat: location!.lat, lng: location!.lng, photoUrl: photoUrl! })

    // Reset for the next photo
    setPhotoUrl(null)
    setName('')
    setDescription('')
    setLocation(null)
    if (fileInput.current) fileInput.current.value = ''
    setJustSubmitted(true)
  }

  const inputClass =
    'mt-1.5 w-full rounded-xl bg-surface px-3.5 py-2.5 text-[15px] ring-1 ring-border outline-none placeholder:text-subtle focus:bg-background focus:ring-2 focus:ring-ring'

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-6">
      {justSubmitted && (
        <p role="status" className="rounded-2xl bg-[var(--tag-green-bg)] px-4 py-3 text-sm">
          🎉 Thanks! Your photo is in review. You’ll earn your reward once the community confirms it.
        </p>
      )}

      {/* Photo */}
      <div>
        <span className="text-sm font-medium" id={`${id}-photo-label`}>
          Photo
        </span>
        <input
          ref={fileInput}
          id={`${id}-photo`}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          aria-labelledby={`${id}-photo-label`}
          aria-describedby={errors.photo ? `${id}-photo-error` : undefined}
          onClick={(e) => {
            // Fires for label clicks and keyboard activation alike
            if (!requireAuth()) e.preventDefault()
          }}
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
        {photoUrl ? (
          <div className="relative mt-1.5 overflow-hidden rounded-2xl ring-1 ring-border">
            <img src={photoUrl} alt="Your photo preview" className="aspect-[4/3] w-full object-cover" />
            <label
              htmlFor={`${id}-photo`}
              className="absolute right-3 bottom-3 inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-sm font-medium shadow backdrop-blur hover:bg-background"
            >
              <RefreshCw className="size-3.5" aria-hidden="true" /> Change photo
            </label>
          </div>
        ) : (
          <label
            htmlFor={`${id}-photo`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              if (requireAuth()) pickFile(e.dataTransfer.files?.[0])
            }}
            className={`mt-1.5 flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-surface text-center transition-colors hover:bg-hover ${errors.photo ? 'border-[var(--tag-red)]' : 'border-border'}`}
          >
            <span className="grid size-12 place-items-center rounded-full bg-primary-soft text-primary">
              <Camera className="size-6" aria-hidden="true" />
            </span>
            {userId ? (
              <>
                <span className="font-medium">Take or upload a photo</span>
                <span className="text-sm text-muted">Drag it here, or tap to choose · up to 10 MB</span>
              </>
            ) : (
              <>
                <span className="font-medium">Log in to upload a photo</span>
                <span className="text-sm text-muted">You’ll earn {REWARD_CENTS}¢ for every one that’s approved</span>
              </>
            )}
          </label>
        )}
        {errors.photo && (
          <p id={`${id}-photo-error`} className="mt-1.5 text-sm text-[var(--tag-red)]">
            {errors.photo}
          </p>
        )}
      </div>

      {/* Type */}
      <fieldset>
        <legend className="text-sm font-medium">What is it?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {TYPES.map((t) => {
            const { label, icon: Icon, color, bg } = FEATURE_TYPES[t]
            const on = type === t
            return (
              <label
                key={t}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition has-focus-visible:outline-2 has-focus-visible:outline-ring ${on ? 'ring-2 ring-[var(--primary)]' : 'opacity-70 hover:opacity-100'}`}
                style={{ background: bg }}
              >
                <input type="radio" name="type" value={t} checked={on} onChange={() => setType(t)} className="sr-only" />
                <Icon className="size-3.5" style={{ color }} aria-hidden="true" />
                {label}
              </label>
            )
          })}
        </div>
      </fieldset>

      {/* Name + description */}
      <div className="grid gap-4">
        <div>
          <label htmlFor={`${id}-name`} className="text-sm font-medium">
            Name
          </label>
          <input
            id={`${id}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Library east entrance ramp"
            maxLength={80}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? `${id}-name-error` : undefined}
            className={inputClass}
          />
          {errors.name && (
            <p id={`${id}-name-error`} className="mt-1.5 text-sm text-[var(--tag-red)]">
              {errors.name}
            </p>
          )}
        </div>
        <div>
          <label htmlFor={`${id}-desc`} className="text-sm font-medium">
            Description
          </label>
          <textarea
            id={`${id}-desc`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does it look like? Handrails, automatic doors, which side of the building…"
            rows={3}
            maxLength={300}
            aria-invalid={!!errors.description}
            aria-describedby={`${id}-desc-hint${errors.description ? ` ${id}-desc-error` : ''}`}
            className={`${inputClass} resize-none`}
          />
          <p id={`${id}-desc-hint`} className="mt-1 text-xs text-muted">
            This is also read aloud to screen-reader users as the photo’s description.
          </p>
          {errors.description && (
            <p id={`${id}-desc-error`} className="mt-1 text-sm text-[var(--tag-red)]">
              {errors.description}
            </p>
          )}
        </div>
      </div>

      {/* Location */}
      <div>
        <div className="flex items-end justify-between gap-2">
          <span className="text-sm font-medium" id={`${id}-loc-label`}>
            Where is it?
          </span>
          <button
            type="button"
            onClick={locateMe}
            disabled={locating}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1.5 text-sm font-medium hover:brightness-[0.97] disabled:opacity-60"
          >
            {locating ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <LocateFixed className="size-3.5" aria-hidden="true" />
            )}
            Use my location
          </button>
        </div>
        <div
          className={`mt-2 h-64 overflow-hidden rounded-2xl ring-1 ${errors.location ? 'ring-[var(--tag-red)]' : 'ring-border'}`}
          aria-labelledby={`${id}-loc-label`}
          role="group"
        >
          <LocationPicker value={location} onChange={setLocation} center={mapCenter} />
        </div>
        <p className="mt-1.5 flex items-center gap-1 text-xs text-muted" aria-live="polite">
          <MapPin className="size-3" aria-hidden="true" />
          {location
            ? `Pinned at ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`
            : 'Tap the map to drop a pin, or use your location.'}
        </p>
        {errors.location && <p className="mt-1 text-sm text-[var(--tag-red)]">{errors.location}</p>}
      </div>

      <button
        type="submit"
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-[15px] font-medium text-primary-foreground shadow-[0_2px_8px_-2px_rgb(11_107_203/0.35)] transition hover:bg-primary-hover sm:w-auto"
      >
        {userId ? 'Send for review' : 'Log in to upload'}
      </button>
    </form>
  )
}
