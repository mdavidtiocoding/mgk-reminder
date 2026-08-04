import { redirect } from "next/navigation"

import {
  getPrimaryDivision,
  isUserAdmin,
  resolveUserDivisions,
} from "@/lib/auth/user-divisions"
import { createClient } from "@/lib/supabase/server"
import type { Division } from "@/lib/steps"

export async function getCurrentUserContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, email, division, divisions, status")
    .eq("id", user.id)
    .single()

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
