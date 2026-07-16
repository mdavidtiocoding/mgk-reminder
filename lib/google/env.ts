export const GOOGLE_CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar.events"

export function getGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim()

  if (!clientId || !clientSecret) {
    return null
  }

  return { clientId, clientSecret, redirectUri: redirectUri ?? "" }
}

/** App origin for post-OAuth redirects — derived from GOOGLE_REDIRECT_URI when set. */
export function getAppOrigin(): string {
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim()
  if (redirectUri) {
    try {
      return new URL(redirectUri).origin
    } catch {
      // fall through
    }
  }

  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
}

const CALLBACK_PATH = "/api/auth/google/callback"

/**
 * Pick redirect_uri for OAuth — must match an Authorized redirect URI in Google Cloud Console.
 * Uses GOOGLE_REDIRECT_URI when its origin matches the current site; otherwise current origin.
 */
export function resolveGoogleRedirectUri(requestUrl: URL): string {
  const fromRequest = `${requestUrl.origin}${CALLBACK_PATH}`
  const fromEnv = process.env.GOOGLE_REDIRECT_URI?.trim()

  if (fromEnv) {
    try {
      const envOrigin = new URL(fromEnv).origin
      if (envOrigin === requestUrl.origin) {
        return fromEnv
      }
    } catch {
      // ignore invalid env URL
    }
  }

  return fromRequest
}
