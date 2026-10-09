import { redirect } from "next/navigation"

import { getSessionProfile, getSessionUser } from "@/lib/auth/session"
import {
  getPrimaryDivision,
  isUserAdmin,
  resolveUserDivisions,
} from "@/lib/auth/user-divisions"
import { createClient } from "@/lib/supabase/server"
import type { Division } from "@/lib/steps"

export async function getCurrentUserContext() {
  const user = await getSessionUser()

  if (!user) {
    redirect("/login")
  }

  const [supabase, profile] = await Promise.all([
    createClient(),
    getSessionProfile(user.id),
  ])

  const userDivisions = resolveUserDivisions(profile)
  const primaryDivision =
    (profile?.division as Division | null) ??
    getPrimaryDivision(userDivisions)

  return {
    supabase,
    user,
    profile,
    userDivisions,
    primaryDivision,
    isAdmin: isUserAdmin(userDivisions),
  }
}
