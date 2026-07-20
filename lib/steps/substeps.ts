export type SubstepDefinition = {
  key: string
  label: string
  sortOrder: number
}

export type SubstepCompletion = {
  stepCode: string
  substepKey: string
  completedAt: string
  completedBy?: string | null
  completedByName?: string | null
  note?: string | null
  eventDate?: string | null
}

export function parseSubsteps(raw: unknown): SubstepDefinition[] {
  if (!Array.isArray(raw)) return []
  const parsed: SubstepDefinition[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const record = item as Record<string, unknown>
    const key = typeof record.key === "string" ? record.key.trim() : ""
    const label = typeof record.label === "string" ? record.label.trim() : ""
    const sortOrder =
      typeof record.sort_order === "number"
        ? record.sort_order
        : typeof record.sortOrder === "number"
          ? record.sortOrder
          : parsed.length + 1
    if (!key || !label) continue
    parsed.push({ key, label, sortOrder })
  }
  return parsed.sort((a, b) => a.sortOrder - b.sortOrder)
}

export function serializeSubsteps(substeps: SubstepDefinition[]): unknown[] {
  return substeps.map((substep, index) => ({
    key: substep.key,
    label: substep.label,
    sort_order: substep.sortOrder || index + 1,
  }))
}

export function slugifySubstepKey(label: string): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
  return base || `substep_${Date.now()}`
}

export function getCompletedSubstepKeys(
  stepCode: string,
  completions: SubstepCompletion[]
): Set<string> {
  return new Set(
    completions.filter((c) => c.stepCode === stepCode).map((c) => c.substepKey)
  )
}

export function areAllSubstepsComplete(
  substeps: SubstepDefinition[],
  completedKeys: Set<string>
): boolean {
  if (substeps.length === 0) return false
  return substeps.every((substep) => completedKeys.has(substep.key))
}

export function getNextSubstep(
  substeps: SubstepDefinition[],
  completedKeys: Set<string>
): SubstepDefinition | null {
  return substeps.find((substep) => !completedKeys.has(substep.key)) ?? null
}
