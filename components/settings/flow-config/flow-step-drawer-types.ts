import type { FlowConfigRow } from "@/components/settings/flow-config-table"
import type { StepCompletionMode } from "@/lib/steps/completion-mode"
import type { DateField, StepTrigger } from "@/lib/steps"
import { getStep } from "@/lib/steps"
import { triggerConfigsEqual } from "@/lib/steps/trigger-config"
import {
  noteRouteConfigsEqual,
  type NoteRouteConfig,
} from "@/lib/steps/note-route-config"
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
  trigger: StepTrigger
  bastChoice: boolean
  noteRoute: NoteRouteConfig
  hasOutcome: boolean
  outcomeRescheduleField: DateField | null
}

export type FlowStepDrawerHandlers = {
  onSave: (
    stepCode: string,
    draft: FlowStepDraft,
    original: FlowStepDraft
  ) => Promise<{ success: boolean; error?: string }>
  onDuplicateSuccess?: () => void
  onResetSuccess?: () => void
}

export function buildDraftFromRow(row: FlowConfigRow, displayName: string): FlowStepDraft {
  const stepDef = getStep(row.code)
  return {
    name: displayName,
    prerequisites: [...row.prerequisites],
    unlocksSteps: [...row.unlocksSteps],
    completionMode: row.completionMode,
    checklistItems: [...row.checklistItems],
    substeps: row.substeps.map((s) => ({
      ...s,
      checklist: [...(s.checklist ?? [])],
      ...(s.checklistMode ? { checklistMode: s.checklistMode } : {}),
    })),
    trigger: row.trigger ?? stepDef?.trigger ?? { type: "immediate" },
    bastChoice: row.bastChoice ?? stepDef?.bastChoice ?? false,
    hasOutcome: row.hasOutcome ?? stepDef?.hasOutcome ?? false,
    outcomeRescheduleField:
      row.outcomeRescheduleField ?? stepDef?.outcomeRescheduleField ?? null,
    noteRoute: {
      enabled: row.noteRoute?.enabled ?? stepDef?.noteRoute?.enabled ?? false,
      targets: [
        ...(row.noteRoute?.targets ?? stepDef?.noteRoute?.targets ?? []),
      ],
    },
  }
}

export function draftsEqual(a: FlowStepDraft, b: FlowStepDraft): boolean {
  return (
    a.name === b.name &&
    arraysEqual(a.prerequisites, b.prerequisites) &&
    arraysEqual(a.unlocksSteps, b.unlocksSteps) &&
    a.completionMode === b.completionMode &&
    arraysEqual(a.checklistItems, b.checklistItems) &&
    substepsEqual(a.substeps, b.substeps) &&
    triggerConfigsEqual(a.trigger, b.trigger) &&
    a.bastChoice === b.bastChoice &&
    a.hasOutcome === b.hasOutcome &&
    a.outcomeRescheduleField === b.outcomeRescheduleField &&
    noteRouteConfigsEqual(a.noteRoute, b.noteRoute)
  )
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((v, i) => v === b[i])
}

function substepsEqual(a: SubstepDefinition[], b: SubstepDefinition[]): boolean {
  if (a.length !== b.length) return false
  return a.every((s, i) => {
    const other = b[i]
    if (!other) return false
    const aList = (s.checklist ?? []).map((item) => item.trim()).filter(Boolean)
    const bList = (other.checklist ?? []).map((item) => item.trim()).filter(Boolean)
    return (
      s.key === other.key &&
      s.label === other.label &&
      s.sortOrder === other.sortOrder &&
      (s.kind ?? "required") === (other.kind ?? "required") &&
      (s.checklistMode ?? null) === (other.checklistMode ?? null) &&
      aList.length === bList.length &&
      aList.every((item, idx) => item === bList[idx])
    )
  })
}
