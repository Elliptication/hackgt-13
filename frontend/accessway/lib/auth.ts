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
