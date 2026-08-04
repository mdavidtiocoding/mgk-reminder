import type { Division } from "@/lib/steps"

export type UserDivisionsSource = {
  division?: string | null
  divisions?: string[] | null
}

const VALID_DIVISIONS = new Set<string>([
  "marketing",
  "ar",
  "logistik",
  "finance",
  "shipping",
  "project",
  "admin",
])

function isDivision(value: string): value is Division {
  return VALID_DIVISIONS.has(value)
}

/**
 * Resolve effective divisions from profile.
 * Merges legacy `division` with `divisions[]` so admin is not lost if one
 * column is stale after migration.
 */
export function resolveUserDivisions(
  profile: UserDivisionsSource | null | undefined
): Division[] {
  if (!profile) return []

  const merged = new Set<Division>()

  for (const value of profile.divisions ?? []) {
    if (isDivision(value)) merged.add(value)
  }

  if (profile.division && isDivision(profile.division)) {
    merged.add(profile.division)
  }

  return [...merged]
}

export function isUserAdmin(userDivisions: Division[]): boolean {
  return userDivisions.includes("admin")
}

export function userHasDivision(
  userDivisions: Division[],
  target: Division
): boolean {
  if (userDivisions.includes("admin")) return true
  return userDivisions.includes(target)
}

/**
 * Primary division for the legacy `division` column.
 * Prefer admin when present so older checks (`division === "admin"`) keep working.
 */
export function getPrimaryDivision(userDivisions: Division[]): Division | null {
  if (userDivisions.length === 0) return null
  if (userDivisions.includes("admin")) return "admin"
  return userDivisions[0] ?? null
}

/** Keep `division` column in sync when saving `divisions` array. */
export function divisionsToPrimaryColumn(divisions: Division[]): Division | null {
  return getPrimaryDivision(divisions)
}

export function normalizeDivisionsInput(divisions: Division[]): Division[] {
  const unique = [...new Set(divisions.filter(isDivision))]
  return unique
}
