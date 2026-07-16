import { createServiceClient } from "@/lib/supabase/admin"

import { getGoogleOAuthConfig, GOOGLE_CALENDAR_SCOPE } from "./env"

type TokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
}

export function buildGoogleAuthUrl(
  state: string,
  redirectUri: string
): string | null {
  const config = getGoogleOAuthConfig()
  if (!config) return null

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  })

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export async function exchangeGoogleCode(
  code: string,
  redirectUri: string
): Promise<TokenResponse> {
  const config = getGoogleOAuthConfig()
  if (!config) {
    throw new Error("Google OAuth belum dikonfigurasi.")
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  })

  const data = (await response.json()) as TokenResponse & { error?: string; error_description?: string }

  if (!response.ok) {
    throw new Error(data.error_description ?? data.error ?? "Gagal menukar kode OAuth.")
  }

  return data
}

export async function refreshGoogleAccessToken(
  refreshToken: string
): Promise<TokenResponse> {
  const config = getGoogleOAuthConfig()
  if (!config) {
    throw new Error("Google OAuth belum dikonfigurasi.")
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
    }),
  })

  const data = (await response.json()) as TokenResponse & { error?: string; error_description?: string }

  if (!response.ok) {
    throw new Error(data.error_description ?? data.error ?? "Gagal refresh token Google.")
  }

  return data
}

export async function saveGoogleTokensForUser(
  userId: string,
  tokens: TokenResponse
): Promise<void> {
  const service = createServiceClient()
  if (!service) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi.")
  }

  const { data: existing } = await service
    .from("profiles")
    .select("google_refresh_token")
    .eq("id", userId)
    .single()

  const { error } = await service
    .from("profiles")
    .update({
      google_access_token: tokens.access_token,
      google_refresh_token: tokens.refresh_token ?? existing?.google_refresh_token ?? null,
      google_calendar_connected: true,
      notif_google_calendar: true,
    })
    .eq("id", userId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function clearGoogleTokensForUser(userId: string): Promise<void> {
  const service = createServiceClient()
  if (!service) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi.")
  }

  const { error } = await service
    .from("profiles")
    .update({
      google_access_token: null,
      google_refresh_token: null,
      google_calendar_connected: false,
      notif_google_calendar: false,
    })
    .eq("id", userId)

  if (error) {
    throw new Error(error.message)
  }
}

type GoogleProfileTokens = {
  id: string
  google_access_token: string
  google_refresh_token: string
}

export async function getValidGoogleAccessToken(
  profile: GoogleProfileTokens
): Promise<string> {
  const service = createServiceClient()
  if (!service) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi.")
  }

  const attempt = async (accessToken: string) =>
    fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

  let response = await attempt(profile.google_access_token)

  if (response.status !== 401) {
    return profile.google_access_token
  }

  const refreshed = await refreshGoogleAccessToken(profile.google_refresh_token)

  await service
    .from("profiles")
    .update({
      google_access_token: refreshed.access_token,
      google_refresh_token:
        refreshed.refresh_token ?? profile.google_refresh_token,
    })
    .eq("id", profile.id)

  response = await attempt(refreshed.access_token)
  if (response.status === 401) {
    throw new Error("Token Google tidak valid.")
  }

  return refreshed.access_token
}
