"use server"

import { revalidatePath } from "next/cache"

import {
  normalizeRolePermissions,
  ROLE_PERMISSIONS_CONFIG_KEY,
  type RolePermissionsMatrix,
} from "@/lib/auth/permissions"
import { resolveActorName, writeAuditLog } from "@/lib/audit/log"
import { assertPermission } from "@/lib/auth/require-permission"

export type SaveRolePermissionsResult =
  | { success: true }
  | { success: false; error: string }

export async function saveRolePermissions(
  matrix: RolePermissionsMatrix
): Promise<SaveRolePermissionsResult> {
  const auth = await assertPermission("settings_permissions")
  if (!auth.ok) return { success: false, error: auth.error }

  const normalized = normalizeRolePermissions(matrix)
  // Hard lock: admin always keeps matrix editor.
  normalized.admin.settings_permissions = true

  const payload = JSON.stringify(normalized)
  const { error } = await auth.ctx.supabase.from("app_config").upsert(
    {
      key: ROLE_PERMISSIONS_CONFIG_KEY,
      value: payload,
    },
    { onConflict: "key" }
  )

  if (error) {
    return {
      success: false,
      error: error.message.includes("app_config")
        ? "Gagal simpan. Pastikan tabel app_config sudah ada."
        : error.message,
    }
  }

  const actorName = await resolveActorName(
    auth.ctx.user.id,
    auth.ctx.profile?.name ?? auth.ctx.user.email
  )
  await writeAuditLog({
    actorId: auth.ctx.user.id,
    actorName,
    action: "permissions.update",
    summary: "Update matriks akses role",
    entityType: "permissions",
  })

  revalidatePath("/settings")
  revalidatePath("/settings/permissions")
  return { success: true }
}
