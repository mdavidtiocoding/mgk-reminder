import { redirect } from "next/navigation"

import { getSessionProfile, getSessionUser } from "@/lib/auth/session"
import { isUserAdmin, resolveUserDivisions } from "@/lib/auth/user-divisions"
import { createClient } from "@/lib/supabase/server"

export async function requireAdmin() {
  const user = await getSessionUser()

  if (!user) {
    redirect("/login")
  }

  const [supabase, profile] = await Promise.all([
    createClient(),
    getSessionProfile(user.id),
  ])

  const userDivisions = resolveUserDivisions(profile)
  if (!isUserAdmin(userDivisions) || profile?.status !== "active") {
    redirect("/")
  }

  return {
    user,
    profile,
    userDivisions,
    supabase,
  }
}
