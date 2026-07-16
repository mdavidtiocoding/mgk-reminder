import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"

export async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, division, email, status")
    .eq("id", user.id)
    .single()

  if (profile?.division !== "admin" || profile?.status !== "active") {
    redirect("/")
  }

  return {
    user,
    profile,
    supabase,
  }
}
