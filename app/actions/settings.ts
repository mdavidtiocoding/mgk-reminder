"use server"

import { revalidatePath } from "next/cache"

import { isUserAdmin, resolveUserDivisions } from "@/lib/auth/user-divisions"
import { createClient } from "@/lib/supabase/server"

async function assertAdminProfile(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("division, divisions")
    .eq("id", userId)
    .single()

  return isUserAdmin(resolveUserDivisions(profile))
}

export async function updateNotificationPrefs(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return

  await supabase
    .from("profiles")
    .update({
      notif_email: formData.get("notif_email") === "on",
      notif_push: formData.get("notif_push") === "on",
    })
    .eq("id", user.id)

  revalidatePath("/settings")
}

export async function updateReminderConfig(
  stepCode: string,
  updates: {
    enabled?: boolean
    repeat_days?: number | null
    max_repeats?: number | null
    notify_channel?: "all" | "email" | "push" | "calendar"
  }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { success: false, error: "Unauthorized" }

  if (!(await assertAdminProfile(supabase, user.id))) {
    return { success: false, error: "Admin only" }
  }

  const payload: Record<string, unknown> = {}
  if (updates.enabled !== undefined) {
    payload.enabled = updates.enabled
  }
  if (updates.repeat_days !== undefined) {
    payload.repeat_days = updates.repeat_days
  }
  if (updates.max_repeats !== undefined) {
    payload.max_repeats = updates.max_repeats
  }
  if (updates.notify_channel !== undefined) {
    payload.notify_channel = updates.notify_channel
  }

  const { error } = await supabase
    .from("reminder_config")
    .update(payload)
    .eq("step_code", stepCode)

  if (error) return { success: false, error: error.message }

  revalidatePath("/settings")
  return { success: true }
}

export async function updateStepDefinitionName(stepCode: string, name: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { success: false, error: "Unauthorized" }

  if (!(await assertAdminProfile(supabase, user.id))) {
    return { success: false, error: "Admin only" }
  }

  const trimmed = name.trim()
  if (!trimmed) {
    return { success: false, error: "Nama tidak boleh kosong" }
  }
  if (trimmed.length > 200) {
    return { success: false, error: "Nama terlalu panjang" }
  }

  const { data, error } = await supabase
    .from("step_definitions")
    .update({ name: trimmed })
    .eq("code", stepCode)
    .select("code")
    .maybeSingle()

  if (error) return { success: false, error: error.message }
  if (!data) {
    return {
      success: false,
      error: "Update ditolak (jalankan database/add-step-name-edit.sql)",
    }
  }

  revalidatePath("/settings/reminders")
  revalidatePath("/projects/[id]", "page")
  revalidatePath("/")
  revalidatePath("/tasks")

  return { success: true, name: trimmed }
}

export async function updateAppConfig(updates: {
  hoggerDays?: number
  warningDays?: number
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { success: false, error: "Unauthorized" }

  if (!(await assertAdminProfile(supabase, user.id))) {
    return { success: false, error: "Admin only" }
  }

  const rows: { key: string; value: string }[] = []
  if (updates.hoggerDays !== undefined) {
    if (!Number.isInteger(updates.hoggerDays) || updates.hoggerDays < 1) {
      return { success: false, error: "Hogger days harus angka ≥ 1" }
    }
    rows.push({ key: "hogger_days", value: String(updates.hoggerDays) })
  }
  if (updates.warningDays !== undefined) {
    if (!Number.isInteger(updates.warningDays) || updates.warningDays < 1) {
      return { success: false, error: "Warning days harus angka ≥ 1" }
    }
    rows.push({ key: "warning_days", value: String(updates.warningDays) })
  }

  if (rows.length === 0) return { success: true }

  const { error } = await supabase.from("app_config").upsert(rows, { onConflict: "key" })
  if (error) return { success: false, error: error.message }

  revalidatePath("/settings")
  revalidatePath("/")
  revalidatePath("/tasks")
  return { success: true }
}
