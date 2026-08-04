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

/** Resolve effective divisions from profile (array takes precedence over legacy single column). */
export function resolveUserDivisions(
  profile: UserDivisionsSource | null | undefined
): Division[] {
  if (!profile) return []

  const fromArray = (profile.divisions ?? []).filter(isDivision)
  if (fromArray.length > 0) return fromArray

  if (profile.division && isDivision(profile.division)) {
    return [profile.division]
  }

  return []
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

/** Primary division for display (legacy column sync + sidebar badge). */
export function getPrimaryDivision(userDivisions: Division[]): Division | null {
  if (userDivisions.length === 0) return null
  const operational = userDivisions.filter((d) => d !== "admin")
  return operational[0] ?? userDivisions[0] ?? null
}

/** Keep `division` column in sync when saving `divisions` array. */
export function divisionsToPrimaryColumn(divisions: Division[]): Division | null {
  return getPrimaryDivision(divisions)
}

export function normalizeDivisionsInput(divisions: Division[]): Division[] {
  const unique = [...new Set(divisions.filter(isDivision))]
  return unique
}
