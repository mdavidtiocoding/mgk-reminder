export type SubstepKind = "required" | "reminder"

export type SubstepDefinition = {
  key: string
  label: string
  sortOrder: number
  /** required = wajib selesai agar step unlock; reminder = self-reminder, tidak blok unlock */
  kind?: SubstepKind
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

export const SUBSTEP_KIND_LABELS: Record<SubstepKind, string> = {
  required: "Wajib (unlock)",
  reminder: "Reminder saja",
}

export function getSubstepKind(substep: SubstepDefinition): SubstepKind {
  return substep.kind === "reminder" ? "reminder" : "required"
}

export function parseSubstepKind(value: unknown): SubstepKind {
  return value === "reminder" ? "reminder" : "required"
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
    parsed.push({
      key,
      label,
      sortOrder,
      kind: parseSubstepKind(record.kind),
    })
  }
  return parsed.sort((a, b) => a.sortOrder - b.sortOrder)
}

export function serializeSubsteps(substeps: SubstepDefinition[]): unknown[] {
  return substeps.map((substep, index) => ({
    key: substep.key,
    label: substep.label,
    sort_order: substep.sortOrder || index + 1,
    kind: getSubstepKind(substep),
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

export function getRequiredSubsteps(substeps: SubstepDefinition[]): SubstepDefinition[] {
  return substeps.filter((substep) => getSubstepKind(substep) === "required")
}

export function getReminderSubsteps(substeps: SubstepDefinition[]): SubstepDefinition[] {
  return substeps.filter((substep) => getSubstepKind(substep) === "reminder")
}

export function areAllSubstepsComplete(
  substeps: SubstepDefinition[],
  completedKeys: Set<string>
): boolean {
  if (substeps.length === 0) return false
  return substeps.every((substep) => completedKeys.has(substep.key))
}

/** Step unlocks when all required substeps are done (reminder substeps may stay pending). */
export function areRequiredSubstepsComplete(
  substeps: SubstepDefinition[],
  completedKeys: Set<string>
): boolean {
  const required = getRequiredSubsteps(substeps)
  if (required.length === 0) {
    return areAllSubstepsComplete(substeps, completedKeys)
  }
  return required.every((substep) => completedKeys.has(substep.key))
}

export function getPendingReminderSubsteps(
  substeps: SubstepDefinition[],
  completedKeys: Set<string>
): SubstepDefinition[] {
  return getReminderSubsteps(substeps).filter((substep) => !completedKeys.has(substep.key))
}

export function getNextRequiredSubstep(
  substeps: SubstepDefinition[],
  completedKeys: Set<string>
): SubstepDefinition | null {
  return (
    getRequiredSubsteps(substeps).find((substep) => !completedKeys.has(substep.key)) ?? null
  )
}

/** Next incomplete sub-step in order (legacy — prefers required chain). */
export function getNextSubstep(
  substeps: SubstepDefinition[],
  completedKeys: Set<string>
): SubstepDefinition | null {
  const nextRequired = getNextRequiredSubstep(substeps, completedKeys)
  if (nextRequired) return nextRequired
  return getPendingReminderSubsteps(substeps, completedKeys)[0] ?? null
}

export function canCompleteSubstepNow(
  substep: SubstepDefinition,
  substeps: SubstepDefinition[],
  completedKeys: Set<string>
): boolean {
  if (completedKeys.has(substep.key)) return false
  if (getSubstepKind(substep) === "reminder") return true
  return getNextRequiredSubstep(substeps, completedKeys)?.key === substep.key
}
