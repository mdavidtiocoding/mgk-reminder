export type SubstepKind = "required" | "reminder"

/** How checklist items must be completed on a sub-step. */
export type SubstepChecklistMode = "checklist" | "checklist_keterangan"

export type SubstepDefinition = {
  key: string
  label: string
  sortOrder: number
  /** required = wajib selesai agar step unlock; reminder = self-reminder, tidak blok unlock */
  kind?: SubstepKind
  /** If set, this sub-step cannot be marked done until the checklist is complete. */
  checklist?: string[]
  /** checklist = all must be checked; checklist_keterangan = unchecked needs a note. */
  checklistMode?: SubstepChecklistMode
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
    const checklistRaw = record.checklist_items ?? record.checklist
    const checklist = Array.isArray(checklistRaw)
      ? checklistRaw
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
      : []
    const checklistMode = parseSubstepChecklistMode(record.checklist_mode ?? record.checklistMode)
    parsed.push({
      key,
      label,
      sortOrder,
      kind: parseSubstepKind(record.kind),
      ...(checklist.length > 0
        ? {
            checklist,
            checklistMode: checklistMode ?? "checklist_keterangan",
          }
        : {}),
    })
  }
  return parsed.sort((a, b) => a.sortOrder - b.sortOrder)
}

export function serializeSubsteps(substeps: SubstepDefinition[]): unknown[] {
  return substeps.map((substep, index) => {
    const checklist = getSubstepChecklist(substep)
    const mode = getSubstepChecklistMode(substep)
    return {
      key: substep.key,
      label: substep.label,
      sort_order: substep.sortOrder || index + 1,
      kind: getSubstepKind(substep),
      ...(checklist.length > 0 && mode
        ? {
            checklist_items: checklist,
            checklist_mode: mode,
          }
        : {}),
    }
  })
}

export function getSubstepChecklist(substep: SubstepDefinition): string[] {
  return (substep.checklist ?? []).map((item) => item.trim()).filter(Boolean)
}

export function parseSubstepChecklistMode(value: unknown): SubstepChecklistMode | null {
  if (value === "checklist" || value === "checklist_keterangan") return value
  return null
}

/** null = no checklist on this sub-step. */
export function getSubstepChecklistMode(
  substep: SubstepDefinition
): SubstepChecklistMode | null {
  const checklist = getSubstepChecklist(substep)
  if (checklist.length === 0) return null
  return parseSubstepChecklistMode(substep.checklistMode) ?? "checklist_keterangan"
}

export function substepAllowsItemNotes(substep: SubstepDefinition): boolean {
  return getSubstepChecklistMode(substep) === "checklist_keterangan"
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

/** Undo the latest completed item first; later required sub-steps block earlier undo. */
export function canUndoSubstepNow(
  substep: SubstepDefinition,
  substeps: SubstepDefinition[],
  completedKeys: Set<string>
): boolean {
  if (!completedKeys.has(substep.key)) return false
  const index = substeps.findIndex((item) => item.key === substep.key)
  if (index < 0) return false
  return !substeps
    .slice(index + 1)
    .some(
      (item) => getSubstepKind(item) === "required" && completedKeys.has(item.key)
    )
}
