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
  searchParams: Promise<{ tab?: string | string[] }>
}) {
  const { tab } = await searchParams
  const active: ContributeTab = tab === 'review' ? 'review' : 'add'

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
          <ReviewQueue />
        )}
      </div>
    </div>
  )
}
