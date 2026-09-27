import type { Metadata } from 'next'

import { Hero } from './_components/Hero'
import { MySubmissions } from './_components/MySubmissions'
import { ReviewQueue } from './_components/ReviewQueue'
import { Tabs, type ContributeTab } from './_components/Tabs'
import { UploadForm } from './_components/UploadForm'

export const metadata: Metadata = {
  title: 'Contribute',
}

export default async function ContributePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const active: ContributeTab = one(params.tab) === 'review' ? 'review' : 'add'

  // Opened from a report on the map: review that one first.
  const featureId = one(params.feature)
  const lat = Number(one(params.lat))
  const lng = Number(one(params.lng))
  const focus = featureId && Number.isFinite(lat) && Number.isFinite(lng) ? { featureId, lat, lng } : null

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <Hero />
      <Tabs active={active} />

      <div className="mt-8">
        {active === 'add' ? (
          <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
            <section aria-labelledby="upload-heading">
              <h2 id="upload-heading" className="text-xl font-bold">
                New photo
              </h2>
              <UploadForm />
            </section>

            <MySubmissions />
          </div>
        ) : (
          <ReviewQueue focus={focus} />
        )}
      </div>
    </div>
  )
}
