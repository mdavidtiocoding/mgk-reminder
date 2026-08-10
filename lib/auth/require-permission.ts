import { redirect } from "next/navigation"

import {
  checkUserPermission,
  getRolePermissions,
  permissionsForUser,
  type PermissionKey,
  type RolePermissionsMatrix,
} from "@/lib/auth/permissions"
import { resolveUserDivisions } from "@/lib/auth/user-divisions"
import { type Division } from "@/lib/steps"
import { createClient } from "@/lib/supabase/server"

export type PermissionContext = {
  user: { id: string; email?: string | null }
  profile: {
    name: string | null
    division: string | null
    divisions: string[] | null
    email: string | null
    status: string | null
    notif_email?: boolean | null
    notif_push?: boolean | null
    google_calendar_connected?: boolean | null
  } | null
  userDivisions: Division[]
  matrix: RolePermissionsMatrix
  permissions: Record<PermissionKey, boolean>
  supabase: Awaited<ReturnType<typeof createClient>>
}

export async function getPermissionContext(): Promise<PermissionContext | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "name, division, divisions, email, status, notif_email, notif_push, google_calendar_connected"
    )
    .eq("id", user.id)
    .single()

  const userDivisions = resolveUserDivisions(profile)
  const matrix = await getRolePermissions(supabase)

  return {
    user,
    profile,
    userDivisions,
    matrix,
    permissions: permissionsForUser(userDivisions, matrix),
    supabase,
  }
}

/** Redirect to home if the current user lacks the permission. */
export async function requirePermission(permission: PermissionKey) {
  const ctx = await getPermissionContext()
  if (!ctx) redirect("/login")
  if (ctx.profile?.status !== "active") redirect("/pending-approval")
  if (!ctx.permissions[permission]) redirect("/")
  return ctx
}

export async function assertPermission(
  permission: PermissionKey
): Promise<
  | { ok: true; ctx: PermissionContext }
  | { ok: false; error: string }
> {
  const ctx = await getPermissionContext()
  if (!ctx) {
    return { ok: false, error: "Silakan login terlebih dahulu." }
  }
  if (ctx.profile?.status !== "active") {
    return { ok: false, error: "Akun belum aktif." }
  }
  if (!ctx.permissions[permission]) {
    return { ok: false, error: "Anda tidak punya akses untuk aksi ini." }
  }
  return { ok: true, ctx }
}

/** Server helper when you already have divisions + supabase. */
export async function hasPermission(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userDivisions: Division[],
  permission: PermissionKey
): Promise<boolean> {
  return checkUserPermission(supabase, userDivisions, permission)
}
