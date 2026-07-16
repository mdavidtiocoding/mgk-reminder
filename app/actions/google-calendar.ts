"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { clearGoogleTokensForUser } from "@/lib/google/oauth"
import { createClient } from "@/lib/supabase/server"

export async function disconnectGoogleCalendar() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  await clearGoogleTokensForUser(user.id)
  revalidatePath("/settings")
}
