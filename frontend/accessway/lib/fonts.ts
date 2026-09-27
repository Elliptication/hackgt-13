import { Inter, Nunito } from 'next/font/google'

// Variable names must stay in sync with `@theme inline` in styles/globals.css,
// which reads var(--font-inter) and var(--font-nunito).
export const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
  display: 'swap',
})
