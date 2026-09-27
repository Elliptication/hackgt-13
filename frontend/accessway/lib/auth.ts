export const GOOGLE_LOGIN_URL = 'https://api.accessway.tech/auth/login'

/**
 * Returns the signed-in user as JSON `{ id, name, email }` (status 401 when
 * nobody is signed in). Called with cookies included, so if it's on another
 * origin your backend needs CORS with `allow_credentials=True` and this app's
 * origin allowed. e.g. 'http://localhost:6767/auth/me'
 */
export const CURRENT_USER_URL: string = 'https://api.accessway.tech/auth/me'
export const LOGOUT_URL: string = 'https://api.accessway.tech/auth/logout'

/**
 * The full address the Google button goes to, carrying where to come back to.
 *
 * `next` is sent as a full URL (e.g. http://localhost:3000/map), not just a
 * path, so the backend knows which site to send people back to — the live
 * site or your local dev server. The backend only accepts sites on its
 * FRONTEND_ORIGINS list (backend/routers/auth.py).
 */
export function googleLoginHref(next: string): string {
  const url = new URL(GOOGLE_LOGIN_URL, window.location.origin)
  url.searchParams.set('next', new URL(next, window.location.origin).toString())
  return url.toString()
}

const DEFAULT_NEXT = '/contribute'

/**
 * Sanitise the `?next=` redirect target on the login page.
 *
 * Only same-origin absolute paths are allowed. Anything else — an external
 * URL, a protocol-relative `//evil.com`, a repeated query param — falls back
 * to the default, so a crafted link can't bounce a user off-site after login.
 */
export function safeNextPath(next: string | string[] | undefined): string {
  const value = Array.isArray(next) ? next[0] : next
  if (!value) return DEFAULT_NEXT

  // Must be a root-relative path, and not protocol-relative ("//host").
  if (!value.startsWith('/') || value.startsWith('//')) return DEFAULT_NEXT
  // Reject anything smuggling a scheme or backslash-based host past the check.
  if (value.includes('\\') || value.includes(':')) return DEFAULT_NEXT

  return value
}
