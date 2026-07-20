import { randomBytes } from "crypto"
import { NextResponse } from "next/server"

import { resolveGoogleRedirectUri } from "@/lib/google/env"
import { buildGoogleAuthUrl } from "@/lib/google/oauth"
import { createClient } from "@/lib/supabase/server"

const STATE_COOKIE = "google_oauth_state"
const REDIRECT_URI_COOKIE = "google_oauth_redirect_uri"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const redirectUri = resolveGoogleRedirectUri(requestUrl)
  const appOrigin = requestUrl.origin

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL("/login", appOrigin))
  }

  const state = randomBytes(24).toString("hex")
  const authUrl = buildGoogleAuthUrl(state, redirectUri)

  if (!authUrl) {
    return NextResponse.redirect(
      new URL(
        `/settings?google=missing_config&redirect_uri=${encodeURIComponent(redirectUri)}`,
        appOrigin
      )
    )
  }

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 10,
  }

  const response = NextResponse.redirect(authUrl)
  response.cookies.set(STATE_COOKIE, state, cookieOptions)
  response.cookies.set(REDIRECT_URI_COOKIE, redirectUri, cookieOptions)

  return response
}
