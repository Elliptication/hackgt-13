import { Atkinson_Hyperlegible_Next } from 'next/font/google'

/**
 * Atkinson Hyperlegible Next, from the Braille Institute: drawn so that letters
 * people with low vision confuse (I l 1, O 0, b d) are unmistakable. The one
 * typeface on the site, headings included — an accessibility map should be the
 * easiest thing on the page to read.
 *
 * The variable name must stay in sync with `@theme inline` in styles/globals.css.
 */
export const atkinson = Atkinson_Hyperlegible_Next({
  subsets: ['latin'],
  variable: '--font-atkinson',
  display: 'swap',
})
