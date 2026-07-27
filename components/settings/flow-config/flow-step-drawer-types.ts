import type { FlowConfigRow } from "@/components/settings/flow-config-table"
import type { StepCompletionMode } from "@/lib/steps/completion-mode"
import type { SubstepDefinition } from "@/lib/steps/substeps"

export type FlowPageMode = "view" | "edit"

export type AllStepOption = { code: string; name: string; stage: number }

export type FlowStepDraft = {
  name: string
  prerequisites: string[]
  unlocksSteps: string[]
  completionMode: StepCompletionMode
  checklistItems: string[]
  substeps: SubstepDefinition[]
}

export type FlowStepDrawerHandlers = {
  onSave: (stepCode: string, draft: FlowStepDraft, original: FlowStepDraft) => Promise<boolean>
  onDuplicateSuccess?: () => void
  onResetSuccess?: () => void
}

export function buildDraftFromRow(row: FlowConfigRow, displayName: string): FlowStepDraft {
  return {
    name: displayName,
    prerequisites: [...row.prerequisites],
    unlocksSteps: [...row.unlocksSteps],
    completionMode: row.completionMode,
    checklistItems: [...row.checklistItems],
    substeps: row.substeps.map((s) => ({ ...s })),
  }
}

export function draftsEqual(a: FlowStepDraft, b: FlowStepDraft): boolean {
  return (
    a.name === b.name &&
    arraysEqual(a.prerequisites, b.prerequisites) &&
    arraysEqual(a.unlocksSteps, b.unlocksSteps) &&
    a.completionMode === b.completionMode &&
    arraysEqual(a.checklistItems, b.checklistItems) &&
    substepsEqual(a.substeps, b.substeps)
  )
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((v, i) => v === b[i])
}

function substepsEqual(a: SubstepDefinition[], b: SubstepDefinition[]): boolean {
  if (a.length !== b.length) return false
  return a.every(
    (s, i) =>
      s.key === b[i]?.key &&
      s.label === b[i]?.label &&
      s.sortOrder === b[i]?.sortOrder &&
      (s.kind ?? "required") === (b[i]?.kind ?? "required")
  )
}
