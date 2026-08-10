import { cache } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"

import { STEPS, type DateField, type StepDefinition } from "@/lib/steps"
import {
  inferCompletionMode,
} from "@/lib/steps/completion-mode"
import { parseSubsteps, type SubstepDefinition } from "@/lib/steps/substeps"
import { parseTriggerConfig } from "@/lib/steps/trigger-config"

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
  trigger_config?: unknown
  has_outcome?: boolean | null
  outcome_reschedule_field?: string | null
  bast_choice?: boolean | null
}

const DATE_FIELDS = new Set<string>([
  "ex_work_date",
  "etd_date",
  "eta_date",
  "mos_date",
])

export function mergeRuntimeSteps(rows: StepDefinitionRow[]): RuntimeStep[] {
  const byCode = new Map(rows.map((row) => [row.code, row]))

  return STEPS.map((step) => {
    const row = byCode.get(step.code)
    const checklist = row?.checklist_items ?? step.checklist
    const triggerOverride = parseTriggerConfig(row?.trigger_config)
    const hasOutcome =
      row?.has_outcome != null ? row.has_outcome : step.hasOutcome
    const rescheduleRaw = row?.outcome_reschedule_field
    const outcomeRescheduleField =
      typeof rescheduleRaw === "string" && DATE_FIELDS.has(rescheduleRaw)
        ? (rescheduleRaw as DateField)
        : step.outcomeRescheduleField
    const bastChoice =
      row?.bast_choice != null ? row.bast_choice : step.bastChoice

    return {
      ...step,
      name: row?.name?.trim() || step.name,
      prerequisites: row?.prerequisites ?? step.prerequisites,
      checklist,
      completionMode: inferCompletionMode(
        checklist,
        row?.completion_mode ?? null
      ),
      trigger: triggerOverride ?? step.trigger,
      hasOutcome: hasOutcome || undefined,
      outcomeRescheduleField,
      bastChoice: bastChoice || undefined,
      substeps: parseSubsteps(row?.substeps),
    }
  })
}

export const loadRuntimeSteps = cache(
  async (supabase: SupabaseClient): Promise<RuntimeStep[]> => {
    const withTrigger = await supabase
      .from("step_definitions")
      .select(
        "code, name, prerequisites, checklist_items, completion_mode, substeps, trigger_config, has_outcome, outcome_reschedule_field, bast_choice"
      )

    if (!withTrigger.error) {
      return mergeRuntimeSteps((withTrigger.data ?? []) as StepDefinitionRow[])
    }

    const withOutcome = await supabase
      .from("step_definitions")
      .select(
        "code, name, prerequisites, checklist_items, completion_mode, substeps, trigger_config, has_outcome, outcome_reschedule_field"
      )

    if (!withOutcome.error) {
      return mergeRuntimeSteps((withOutcome.data ?? []) as StepDefinitionRow[])
    }

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
