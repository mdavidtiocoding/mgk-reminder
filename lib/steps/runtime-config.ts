import { cache } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"

import { STEPS, type StepDefinition } from "@/lib/steps"
import {
  inferCompletionMode,
  parseCompletionMode,
  type StepCompletionMode,
} from "@/lib/steps/completion-mode"
import { parseSubsteps, type SubstepDefinition } from "@/lib/steps/substeps"

export type RuntimeStep = StepDefinition & {
  substeps: SubstepDefinition[]
}

type StepDefinitionRow = {
  code: string
  name: string
  prerequisites: string[] | null
  checklist_items: string[] | null
  completion_mode?: string | null
  substeps?: unknown
}

export function mergeRuntimeSteps(rows: StepDefinitionRow[]): RuntimeStep[] {
  const byCode = new Map(rows.map((row) => [row.code, row]))

  return STEPS.map((step) => {
    const row = byCode.get(step.code)
    const checklist = row?.checklist_items ?? step.checklist
    return {
      ...step,
      name: row?.name?.trim() || step.name,
      prerequisites: row?.prerequisites ?? step.prerequisites,
      checklist,
      completionMode: inferCompletionMode(
        checklist,
        row?.completion_mode ?? null
      ),
      substeps: parseSubsteps(row?.substeps),
    }
  })
}

export const loadRuntimeSteps = cache(
  async (supabase: SupabaseClient): Promise<RuntimeStep[]> => {
    const withMode = await supabase
      .from("step_definitions")
      .select(
        "code, name, prerequisites, checklist_items, completion_mode, substeps"
      )

    if (!withMode.error) {
      return mergeRuntimeSteps((withMode.data ?? []) as StepDefinitionRow[])
    }

    const withSubsteps = await supabase
      .from("step_definitions")
      .select("code, name, prerequisites, checklist_items, substeps")

    if (!withSubsteps.error) {
      return mergeRuntimeSteps((withSubsteps.data ?? []) as StepDefinitionRow[])
    }

    const fallback = await supabase
      .from("step_definitions")
      .select("code, name, prerequisites, checklist_items")

    if (fallback.error) {
      console.error("loadRuntimeSteps:", fallback.error.message)
      return mergeRuntimeSteps([])
    }

    return mergeRuntimeSteps((fallback.data ?? []) as StepDefinitionRow[])
  }
)
