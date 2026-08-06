"use server"

import {
  updateStepCompletionConfig,
  updateStepPrerequisites,
  updateStepSubsteps,
  updateStepTriggerConfig,
  updateStepUnlocks,
} from "@/app/actions/flow-config"
import { updateStepDefinitionName } from "@/app/actions/settings"
import type { FlowStepDraft } from "@/components/settings/flow-config/flow-step-drawer-types"
import { triggerConfigsEqual } from "@/lib/steps/trigger-config"

export async function saveFlowStepDraft(
  stepCode: string,
  draft: FlowStepDraft,
  original: FlowStepDraft
): Promise<{ success: true } | { success: false; error: string }> {
  if (draft.name.trim() !== original.name) {
    const result = await updateStepDefinitionName(stepCode, draft.name.trim())
    if (!result?.success) {
      return { success: false, error: result?.error ?? "Gagal menyimpan nama" }
    }
  }

  if (JSON.stringify(draft.prerequisites) !== JSON.stringify(original.prerequisites)) {
    const result = await updateStepPrerequisites(stepCode, draft.prerequisites)
    if (!result.success) return result
  }

  if (JSON.stringify(draft.unlocksSteps) !== JSON.stringify(original.unlocksSteps)) {
    const result = await updateStepUnlocks(stepCode, draft.unlocksSteps)
    if (!result.success) return result
  }

  if (
    draft.completionMode !== original.completionMode ||
    JSON.stringify(draft.checklistItems) !== JSON.stringify(original.checklistItems)
  ) {
    const result = await updateStepCompletionConfig(stepCode, {
      completionMode: draft.completionMode,
      checklistItems: draft.checklistItems,
    })
    if (!result.success) return result
  }

  const cleanedSubsteps = draft.substeps
    .map((s, i) => ({
      key: s.key.trim(),
      label: s.label.trim(),
      sortOrder: i + 1,
      kind: s.kind ?? ("required" as const),
    }))
    .filter((s) => s.label)
  const cleanedOriginal = original.substeps
    .map((s, i) => ({
      key: s.key.trim(),
      label: s.label.trim(),
      sortOrder: i + 1,
      kind: s.kind ?? ("required" as const),
    }))
    .filter((s) => s.label)

  if (JSON.stringify(cleanedSubsteps) !== JSON.stringify(cleanedOriginal)) {
    const result = await updateStepSubsteps(stepCode, cleanedSubsteps)
    if (!result.success) return result
  }

  if (!triggerConfigsEqual(draft.trigger, original.trigger)) {
    const result = await updateStepTriggerConfig(
      stepCode,
      draft.trigger as unknown as Record<string, unknown>
    )
    if (!result.success) return result
  }

  return { success: true }
}
