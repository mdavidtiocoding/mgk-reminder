"use server"

import {
  updateStepBastChoice,
  updateStepCompletionConfig,
  updateStepDelayHours,
  updateStepNoteRouteConfig,
  updateStepOutcomeConfig,
  updateStepPrerequisites,
  updateStepSubsteps,
  updateStepUnlocks,
} from "@/app/actions/flow-config"
import { updateStepDefinitionName } from "@/app/actions/settings"
import type { FlowStepDraft } from "@/components/settings/flow-config/flow-step-drawer-types"
import { noteRouteConfigsEqual } from "@/lib/steps/note-route-config"

type SaveResult = { success: true } | { success: false; error: string }

async function runSave(
  errors: string[],
  task: () => Promise<SaveResult>
) {
  const result = await task()
  if (!result.success) errors.push(result.error)
}

export async function saveFlowStepDraft(
  stepCode: string,
  draft: FlowStepDraft,
  original: FlowStepDraft
): Promise<SaveResult> {
  const errors: string[] = []

  if (draft.name.trim() !== original.name) {
    await runSave(errors, async () => {
      const result = await updateStepDefinitionName(stepCode, draft.name.trim())
      if (!result?.success) {
        return { success: false, error: result?.error ?? "Gagal menyimpan nama" }
      }
      return { success: true }
    })
  }

  if (JSON.stringify(draft.prerequisites) !== JSON.stringify(original.prerequisites)) {
    await runSave(errors, () => updateStepPrerequisites(stepCode, draft.prerequisites))
  }

  if (JSON.stringify(draft.unlocksSteps) !== JSON.stringify(original.unlocksSteps)) {
    await runSave(errors, () => updateStepUnlocks(stepCode, draft.unlocksSteps))
  }

  if (
    draft.completionMode !== original.completionMode ||
    JSON.stringify(draft.checklistItems) !== JSON.stringify(original.checklistItems)
  ) {
    await runSave(errors, () =>
      updateStepCompletionConfig(stepCode, {
        completionMode: draft.completionMode,
        checklistItems: draft.checklistItems,
      })
    )
  }

  const cleanedSubsteps = draft.substeps
    .map((s, i) => {
      const checklist = (s.checklist ?? []).map((item) => item.trim()).filter(Boolean)
      const checklistMode =
        checklist.length > 0
          ? s.checklistMode === "checklist"
            ? ("checklist" as const)
            : ("checklist_keterangan" as const)
          : undefined
      return {
        key: s.key.trim(),
        label: s.label.trim(),
        sortOrder: i + 1,
        kind: s.kind ?? ("required" as const),
        checklist,
        ...(checklistMode ? { checklistMode } : {}),
      }
    })
    .filter((s) => s.label)
  const cleanedOriginal = original.substeps
    .map((s, i) => {
      const checklist = (s.checklist ?? []).map((item) => item.trim()).filter(Boolean)
      const checklistMode =
        checklist.length > 0
          ? s.checklistMode === "checklist"
            ? ("checklist" as const)
            : ("checklist_keterangan" as const)
          : undefined
      return {
        key: s.key.trim(),
        label: s.label.trim(),
        sortOrder: i + 1,
        kind: s.kind ?? ("required" as const),
        checklist,
        ...(checklistMode ? { checklistMode } : {}),
      }
    })
    .filter((s) => s.label)

  if (JSON.stringify(cleanedSubsteps) !== JSON.stringify(cleanedOriginal)) {
    await runSave(errors, () => updateStepSubsteps(stepCode, cleanedSubsteps))
  }

  if (draft.bastChoice !== original.bastChoice) {
    await runSave(errors, () => updateStepBastChoice(stepCode, draft.bastChoice))
  }

  if (
    draft.hasOutcome !== original.hasOutcome ||
    draft.outcomeRescheduleField !== original.outcomeRescheduleField
  ) {
    await runSave(errors, () =>
      updateStepOutcomeConfig(stepCode, {
        hasOutcome: draft.hasOutcome,
        outcomeRescheduleField: draft.outcomeRescheduleField,
      })
    )
  }

  if (!noteRouteConfigsEqual(draft.noteRoute, original.noteRoute)) {
    const noteRoute =
      draft.noteRoute.enabled && draft.noteRoute.targets.length === 0
        ? { enabled: false, targets: [] as string[] }
        : draft.noteRoute
    await runSave(errors, () => updateStepNoteRouteConfig(stepCode, noteRoute))
  }

  if (draft.delayHours !== original.delayHours) {
    await runSave(errors, () => updateStepDelayHours(stepCode, draft.delayHours))
  }

  if (errors.length > 0) {
    return { success: false, error: errors.join(" ") }
  }
  return { success: true }
}
