import { Accessibility } from 'lucide-react'

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="relative isolate flex justify-center overflow-hidden px-4 py-14 sm:py-20">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 size-[26rem] -translate-x-[80%] rounded-full bg-[var(--tag-blue-bg)] blur-3xl" />
        <div className="absolute top-20 left-1/2 size-[22rem] -translate-x-[10%] rounded-full bg-[var(--tag-yellow-bg)] blur-3xl" />
      </div>

      <div className="w-full max-w-sm">
        <div className="text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-primary-soft text-primary">
            <Accessibility className="size-6" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 text-muted">{subtitle}</p>
        </div>

        <div className="mt-8 rounded-3xl bg-background/90 p-6 shadow-[0_8px_30px_-12px_rgb(15_15_15/0.18)] ring-1 ring-border backdrop-blur">
          {children}
        </div>

        {footer && <p className="mt-6 text-center text-sm text-muted">{footer}</p>}
      </div>
    </div>
  )
}
