import { cache } from "react"

import { createClient } from "@/lib/supabase/server"

export type SessionUser = { id: string; email: string | null }

export type SessionProfile = {
  name: string | null
  email: string | null
  division: string | null
  divisions: string[] | null
  status: string | null
  notif_email: boolean | null
  notif_push: boolean | null
  google_calendar_connected: boolean | null
}

/**
 * Verifies the session JWT locally (asymmetric signing keys) instead of a
 * round-trip to Supabase Auth. Deduped per request.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (error || !claims?.sub) return null
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
  }
})

export const getSessionProfile = cache(
  async (userId: string): Promise<SessionProfile | null> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from("profiles")
      .select(
        "name, email, division, divisions, status, notif_email, notif_push, google_calendar_connected"
      )
      .eq("id", userId)
      .single()
    return (data as SessionProfile | null) ?? null
  }
)
