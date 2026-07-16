import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import {
  exchangeGoogleCode,
  saveGoogleTokensForUser,
} from "@/lib/google/oauth"
import { createClient } from "@/lib/supabase/server"

const STATE_COOKIE = "google_oauth_state"
const REDIRECT_URI_COOKIE = "google_oauth_redirect_uri"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const appOrigin = requestUrl.origin
  const { searchParams } = requestUrl
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  if (error) {
    return NextResponse.redirect(new URL("/settings?google=denied", appOrigin))
  }

  const cookieStore = await cookies()
  const savedState = cookieStore.get(STATE_COOKIE)?.value
  const redirectUri = cookieStore.get(REDIRECT_URI_COOKIE)?.value
  cookieStore.delete(STATE_COOKIE)
  cookieStore.delete(REDIRECT_URI_COOKIE)

  if (!code || !state || !savedState || state !== savedState || !redirectUri) {
    return NextResponse.redirect(
      new URL("/settings?google=invalid_state", appOrigin)
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL("/login", appOrigin))
  }

  try {
    const tokens = await exchangeGoogleCode(code, redirectUri)
    await saveGoogleTokensForUser(user.id, tokens)
    return NextResponse.redirect(
      new URL("/settings?google=connected", appOrigin)
    )
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal menghubungkan Google Calendar."
    console.error("[google-oauth] callback error:", err)
    const params = new URLSearchParams({
      google: "error",
      msg: message.slice(0, 300),
    })
    return NextResponse.redirect(
      new URL(`/settings?${params.toString()}`, appOrigin)
    )
  }
}
