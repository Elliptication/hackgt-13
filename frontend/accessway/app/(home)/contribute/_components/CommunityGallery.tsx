'use client'

import { ImageOff, LoaderCircle } from 'lucide-react'

import { useCommunityPhotos } from '@/hooks/useCommunityPhotos'

/**
 * Every photo the community has uploaded, straight from `GET /contributions/`.
 *
 * This exists because that endpoint is the only one that returns `image_path`.
 * Everything else about a photo — its type, its position — lives on a feature
 * row reached separately, so a gallery is the one view that needs no join at
 * all: every photo the community has added, newest first.
 */
export function CommunityGallery() {
  const { all, loading, error, unavailable, bucketUnconfigured } = useCommunityPhotos()

  return (
    <section aria-labelledby="gallery-heading" className="mt-14">
      <h2 id="gallery-heading" className="text-xl font-bold">
        Everything uploaded so far
      </h2>
      <p className="mt-1.5 text-sm text-muted">
        These are the photos behind the pins — where the map can place them.
      </p>

      {loading && (
        <p role="status" className="mt-6 flex items-center gap-2 text-sm text-muted">
          <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />
          Loading photos…
        </p>
      )}

      {unavailable && !loading && (
        <p role="status" className="mt-6 rounded-2xl bg-[var(--tag-yellow-bg)] px-4 py-3 text-sm">
          The AccessWay API isn’t answering, so there’s nothing to show yet.
        </p>
      )}

      {error && !loading && (
        <p role="status" className="mt-6 rounded-2xl bg-[var(--tag-yellow-bg)] px-4 py-3 text-sm">
          {error}
        </p>
      )}

      {bucketUnconfigured && all.length > 0 && (
        <p role="status" className="mt-6 rounded-2xl bg-[var(--tag-yellow-bg)] px-4 py-3 text-sm">
          {all.length} photo{all.length === 1 ? '' : 's'} uploaded, but{' '}
          <code className="rounded bg-background/60 px-1 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_URL</code> is unset
          — the API returns a storage path, and without the project URL there’s nothing to turn it into.
        </p>
      )}

      {!loading && !unavailable && !error && all.length === 0 && (
        <p className="mt-6 rounded-2xl bg-surface px-4 py-6 text-sm text-muted ring-1 ring-border/60">
          Nobody has added a photo yet. Yours would be the first.
        </p>
      )}

      {all.length > 0 && !bucketUnconfigured && (
        <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {all.map((photo) => (
            <li
              key={photo.id}
              className="overflow-hidden rounded-2xl bg-surface ring-1 ring-border transition-shadow hover:shadow-[0_4px_16px_-6px_rgb(15_15_15/0.2)]"
            >
              {photo.photoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element -- a Supabase
                   storage URL, not an asset the optimizer can reach */
                <img
                  src={photo.photoUrl}
                  // The upload form collects a description, but `POST
                  // /contributions/` has nowhere to put it, so there is no real
                  // alt text to use here (REVIEWS-API.md §2).
                  alt={`Community photo ${photo.id}, subject not recorded by the API`}
                  loading="lazy"
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <span className="grid aspect-square w-full place-items-center">
                  <ImageOff className="size-6 text-subtle" aria-hidden="true" />
                </span>
              )}
              <div className="px-3 py-2.5">
                <p className="text-xs font-medium">
                  {new Date(photo.uploadedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>

              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
