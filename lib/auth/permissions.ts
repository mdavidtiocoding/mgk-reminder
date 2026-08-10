import type { SupabaseClient } from "@supabase/supabase-js"

import { DIVISION_LABELS, type Division } from "@/lib/steps"

/** Capability keys admin can grant per role (division). */
export const PERMISSION_KEYS = [
  "create_project",
  "edit_project",
  "change_project_status",
  "delete_project",
  "undo_step",
  "manage_adhoc",
  "settings_users",
  "settings_reminders",
  "settings_flow",
  "settings_demo",
  "settings_app_config",
  "settings_permissions",
] as const

export type PermissionKey = (typeof PERMISSION_KEYS)[number]

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  create_project: "Buat project baru",
  edit_project: "Edit nama / customer project",
  change_project_status: "Ubah status project (hold / selesai)",
  delete_project: "Hapus project",
  undo_step: "Undo step selesai",
  manage_adhoc: "Kelola kasus ad-hoc",
  settings_users: "Settings → User management",
  settings_reminders: "Settings → Reminder config",
  settings_flow: "Settings → Flow config",
  settings_demo: "Settings → Demo preview",
  settings_app_config: "Settings → Threshold HOGGER",
  settings_permissions: "Settings → Akses role (matriks ini)",
}

export const PERMISSION_GROUPS: {
  title: string
  keys: PermissionKey[]
}[] = [
  {
    title: "Project",
    keys: [
      "create_project",
      "edit_project",
      "change_project_status",
      "delete_project",
      "undo_step",
      "manage_adhoc",
    ],
  },
  {
    title: "Settings admin",
    keys: [
      "settings_users",
      "settings_reminders",
      "settings_flow",
      "settings_demo",
      "settings_app_config",
      "settings_permissions",
    ],
  },
]

/** Roles that appear as columns in the matrix (all divisions). */
export const ROLE_KEYS = [
  "marketing",
  "ar",
  "logistik",
  "finance",
  "shipping",
  "project",
  "admin",
] as const satisfies readonly Division[]

export type RoleKey = (typeof ROLE_KEYS)[number]

export type RolePermissionsMatrix = Record<
  RoleKey,
  Record<PermissionKey, boolean>
>

const APP_CONFIG_KEY = "role_permissions"

function defaultForRole(role: RoleKey): Record<PermissionKey, boolean> {
  const allFalse = Object.fromEntries(
    PERMISSION_KEYS.map((k) => [k, false])
  ) as Record<PermissionKey, boolean>

  if (role === "admin") {
    return Object.fromEntries(
      PERMISSION_KEYS.map((k) => [k, true])
    ) as Record<PermissionKey, boolean>
  }

  // Match current product defaults (pre-matrix behavior).
  return {
    ...allFalse,
    create_project: true,
    edit_project: true,
    manage_adhoc: role === "project",
  }
}

export function getDefaultRolePermissions(): RolePermissionsMatrix {
  return Object.fromEntries(
    ROLE_KEYS.map((role) => [role, defaultForRole(role)])
  ) as RolePermissionsMatrix
}

export function getRoleLabel(role: RoleKey): string {
  return DIVISION_LABELS[role] ?? role
}

function isPermissionKey(value: string): value is PermissionKey {
  return (PERMISSION_KEYS as readonly string[]).includes(value)
}

function isRoleKey(value: string): value is RoleKey {
  return (ROLE_KEYS as readonly string[]).includes(value)
}

/** Merge stored JSON with defaults so new keys stay safe. */
export function normalizeRolePermissions(
  raw: unknown
): RolePermissionsMatrix {
  const defaults = getDefaultRolePermissions()
  if (!raw || typeof raw !== "object") return defaults

  const input = raw as Record<string, unknown>
  const result = { ...defaults }

  for (const role of ROLE_KEYS) {
    const row = input[role]
    if (!row || typeof row !== "object") continue
    const next = { ...defaults[role] }
    for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
      if (isPermissionKey(key) && typeof value === "boolean") {
        next[key] = value
      }
    }
    // Never lock admin out of editing the matrix.
    if (role === "admin") {
      next.settings_permissions = true
    }
    result[role] = next
  }

  return result
}

export async function getRolePermissions(
  supabase: SupabaseClient
): Promise<RolePermissionsMatrix> {
  const { data, error } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", APP_CONFIG_KEY)
    .maybeSingle()

  if (error || !data?.value) return getDefaultRolePermissions()

  try {
    return normalizeRolePermissions(JSON.parse(data.value as string))
  } catch {
    return getDefaultRolePermissions()
  }
}

/**
 * True if any of the user's roles grants the permission.
 * Admin division still follows the matrix (defaults: all on).
 */
export function userHasPermission(
  userDivisions: Division[],
  permission: PermissionKey,
  matrix: RolePermissionsMatrix
): boolean {
  if (userDivisions.length === 0) return false
  return userDivisions.some((division) => {
    if (!isRoleKey(division)) return false
    return matrix[division]?.[permission] === true
  })
}

export function permissionsForUser(
  userDivisions: Division[],
  matrix: RolePermissionsMatrix
): Record<PermissionKey, boolean> {
  return Object.fromEntries(
    PERMISSION_KEYS.map((key) => [
      key,
      userHasPermission(userDivisions, key, matrix),
    ])
  ) as Record<PermissionKey, boolean>
}

/** Convenience: load matrix + evaluate one permission. */
export async function checkUserPermission(
  supabase: SupabaseClient,
  userDivisions: Division[],
  permission: PermissionKey
): Promise<boolean> {
  const matrix = await getRolePermissions(supabase)
  return userHasPermission(userDivisions, permission, matrix)
}

export { APP_CONFIG_KEY as ROLE_PERMISSIONS_CONFIG_KEY }
