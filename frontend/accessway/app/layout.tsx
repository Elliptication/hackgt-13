import '@/styles/globals.css'

import type { Metadata, Viewport } from 'next'

import { inter, nunito } from '@/lib/fonts'
import { APP_NAME, APP_TAGLINE, DEFAULT_META_DESCRIPTION } from '@/lib/constants'
import Providers from './providers'

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} | ${APP_TAGLINE}`,
    template: `%s | ${APP_NAME}`,
  },
  description: DEFAULT_META_DESCRIPTION,
}

export const viewport: Viewport = {
  initialScale: 1,
  width: 'device-width',
  themeColor: '#ffffff',
  colorScheme: 'light',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${nunito.variable}`}>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-full focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow">
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
