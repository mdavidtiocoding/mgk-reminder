"use server"

import { revalidatePath } from "next/cache"

import type { ProfileStatus } from "@/lib/auth/profile-status"
import {
  divisionsToPrimaryColumn,
  isUserAdmin,
  normalizeDivisionsInput,
  resolveUserDivisions,
} from "@/lib/auth/user-divisions"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/admin"
import type { Division } from "@/lib/steps"

export type UserActionResult =
  | { success: true }
  | { success: false; error: string }

const DIVISIONS: Division[] = [
  "marketing",
  "ar",
  "logistik",
  "finance",
  "shipping",
  "project",
  "admin",
]

const PROFILE_STATUSES: ProfileStatus[] = ["pending", "active", "suspended"]

function parseDivisionsFromForm(formData: FormData): Division[] {
  const raw = formData.get("divisions")
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        return normalizeDivisionsInput(parsed as Division[])
      }
    } catch {
      // fall through
    }
  }

  const single = formData.get("division") as Division | null
  return single ? normalizeDivisionsInput([single]) : []
}

async function assertAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false as const, error: "Silakan login terlebih dahulu." }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("division, divisions, status")
    .eq("id", user.id)
    .single()

  const userDivisions = resolveUserDivisions(profile)
  if (!isUserAdmin(userDivisions) || profile?.status !== "active") {
    return { ok: false as const, error: "Hanya admin yang bisa mengelola user." }
  }

  return { ok: true as const }
}

export async function createUser(
  formData: FormData
): Promise<UserActionResult> {
  const auth = await assertAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  const name = (formData.get("name") as string)?.trim()
  const email = (formData.get("email") as string)?.trim().toLowerCase()
  const password = formData.get("password") as string
  const divisions = parseDivisionsFromForm(formData)

  if (!name || !email || !password) {
    return { success: false, error: "Nama, email, dan password wajib diisi." }
  }

  if (password.length < 6) {
    return { success: false, error: "Password minimal 6 karakter." }
  }

  if (divisions.length === 0) {
    return { success: false, error: "Pilih minimal satu divisi." }
  }

  if (!divisions.every((d) => DIVISIONS.includes(d))) {
    return { success: false, error: "Division tidak valid." }
  }

  const primaryDivision = divisionsToPrimaryColumn(divisions)
  const service = createServiceClient()
  if (!service) {
    return {
      success: false,
      error: "SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi.",
    }
  }

  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, division: primaryDivision },
  })

  if (error) {
    return { success: false, error: error.message }
  }

  if (data.user) {
    await service.from("profiles").upsert({
      id: data.user.id,
      name,
      email,
      division: primaryDivision,
      divisions,
      status: "active",
    })
  }

  revalidatePath("/settings/users")
  return { success: true }
}

export async function updateUserDivisions(
  userId: string,
  divisions: Division[]
): Promise<UserActionResult> {
  const auth = await assertAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  const normalized = normalizeDivisionsInput(divisions)
  if (normalized.length === 0) {
    return { success: false, error: "Pilih minimal satu divisi." }
  }

  if (!normalized.every((d) => DIVISIONS.includes(d))) {
    return { success: false, error: "Division tidak valid." }
  }

  const primaryDivision = divisionsToPrimaryColumn(normalized)
  const service = createServiceClient()
  if (!service) {
    return {
      success: false,
      error: "SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi.",
    }
  }

  const { error } = await service
    .from("profiles")
    .update({ division: primaryDivision, divisions: normalized })
    .eq("id", userId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/settings/users")
  return { success: true }
}

/** @deprecated Use updateUserDivisions — kept for compatibility. */
export async function updateUserDivision(
  userId: string,
  division: Division
): Promise<UserActionResult> {
  return updateUserDivisions(userId, [division])
}

export async function updateUserStatus(
  userId: string,
  status: ProfileStatus
): Promise<UserActionResult> {
  const auth = await assertAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  if (!PROFILE_STATUSES.includes(status)) {
    return { success: false, error: "Status tidak valid." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user?.id === userId && status !== "active") {
    return { success: false, error: "Tidak bisa mengubah status akun sendiri." }
  }

  const service = createServiceClient()
  if (!service) {
    return {
      success: false,
      error: "SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi.",
    }
  }

  if (status === "active") {
    const { data: target } = await service
      .from("profiles")
      .select("division, divisions")
      .eq("id", userId)
      .single()

    if (resolveUserDivisions(target).length === 0) {
      return {
        success: false,
        error: "Tetapkan divisi terlebih dahulu sebelum mengaktifkan user.",
      }
    }
  }

  const { error } = await service
    .from("profiles")
    .update({ status })
    .eq("id", userId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/settings/users")
  return { success: true }
}

export async function deleteUser(userId: string): Promise<UserActionResult> {
  const auth = await assertAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user?.id === userId) {
    return { success: false, error: "Tidak bisa menghapus akun sendiri." }
  }

  const service = createServiceClient()
  if (!service) {
    return {
      success: false,
      error: "SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi.",
    }
  }

  const { error } = await service.auth.admin.deleteUser(userId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/settings/users")
  return { success: true }
}

export async function listUsers() {
  const auth = await assertAdmin()
  if (!auth.ok) return []

  const service = createServiceClient()
  if (!service) return []

  const { data: profiles } = await service
    .from("profiles")
    .select("id, name, email, division, divisions, status, created_at")
    .order("created_at", { ascending: false })

  return profiles ?? []
}
