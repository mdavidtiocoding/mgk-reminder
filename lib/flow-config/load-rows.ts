import type { SupabaseClient } from "@supabase/supabase-js"

import type { FlowConfigRow } from "@/components/settings/flow-config-table"
import { STEPS, describeTrigger, type StepTrigger } from "@/lib/steps"
import { inferCompletionMode } from "@/lib/steps/completion-mode"
import { parseSubsteps } from "@/lib/steps/substeps"
import { parseTriggerConfig } from "@/lib/steps/trigger-config"

type StepDefRow = {
  code: string
  name: string
  division: string
  stage: number
  sort_order: number
  prerequisites: string[] | null
  checklist_items?: string[] | null
  completion_mode?: string | null
  substeps?: unknown
  trigger_config?: unknown
  bast_choice?: boolean | null
}

async function fetchStepDefinitionRows(
  supabase: SupabaseClient
): Promise<StepDefRow[]> {
  const fullQuery = await supabase
    .from("step_definitions")
    .select(
      "code, name, division, stage, sort_order, prerequisites, checklist_items, completion_mode, substeps, trigger_config, bast_choice"
    )
    .order("sort_order")

  if (!fullQuery.error) {
    return (fullQuery.data ?? []) as StepDefRow[]
  }

  const withTrigger = await supabase
    .from("step_definitions")
    .select(
      "code, name, division, stage, sort_order, prerequisites, checklist_items, completion_mode, substeps, trigger_config"
    )
    .order("sort_order")

  if (!withTrigger.error) {
    return ((withTrigger.data ?? []) as StepDefRow[]).map((row) => ({
      ...row,
      bast_choice: null,
    }))
  }

  const withMode = await supabase
    .from("step_definitions")
    .select(
      "code, name, division, stage, sort_order, prerequisites, checklist_items, completion_mode, substeps"
    )
    .order("sort_order")

  if (!withMode.error) {
    return ((withMode.data ?? []) as StepDefRow[]).map((row) => ({
      ...row,
      trigger_config: null,
      bast_choice: null,
    }))
  }

  const withSubsteps = await supabase
    .from("step_definitions")
    .select(
      "code, name, division, stage, sort_order, prerequisites, checklist_items, substeps"
    )
    .order("sort_order")

  if (!withSubsteps.error) {
    return ((withSubsteps.data ?? []) as StepDefRow[]).map((row) => ({
      ...row,
      completion_mode: null,
      trigger_config: null,
      bast_choice: null,
    }))
  }

  const fallback = await supabase
    .from("step_definitions")
    .select("code, name, division, stage, sort_order, prerequisites, checklist_items")
    .order("sort_order")

  return ((fallback.data ?? []) as StepDefRow[]).map((row) => ({
    ...row,
    substeps: null,
    completion_mode: null,
    trigger_config: null,
    bast_choice: null,
  }))
}

export async function loadFlowConfigRows(
  supabase: SupabaseClient
): Promise<FlowConfigRow[]> {
  const stepDefRows = await fetchStepDefinitionRows(supabase)

  const unlocksMap = new Map<string, string[]>()
  for (const row of stepDefRows) {
    for (const prereq of (row.prerequisites as string[] | null) ?? []) {
      const list = unlocksMap.get(prereq) ?? []
      list.push(row.code)
      unlocksMap.set(prereq, list)
    }
  }

  return [...stepDefRows]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((row) => {
      const stepFromLib = STEPS.find((step) => step.code === row.code)
      const checklistItems =
        (row.checklist_items as string[] | null) ?? stepFromLib?.checklist ?? []
      const triggerOverride = parseTriggerConfig(row.trigger_config)
      const trigger: StepTrigger =
        triggerOverride ?? stepFromLib?.trigger ?? { type: "immediate" }
      const stepForDescribe = stepFromLib
        ? { ...stepFromLib, trigger }
        : undefined
      const bastChoice =
        row.bast_choice != null
          ? row.bast_choice
          : (stepFromLib?.bastChoice ?? false)

      return {
        code: row.code,
        name: row.name,
        division: row.division,
        stage: row.stage,
        prerequisites: (row.prerequisites as string[] | null) ?? [],
        substeps: parseSubsteps(row.substeps),
        completionMode: inferCompletionMode(
          checklistItems,
          row.completion_mode ?? null
        ),
        checklistItems,
        trigger,
        triggerDescription: stepForDescribe
          ? describeTrigger(stepForDescribe)
          : "—",
        unlocksSteps: (unlocksMap.get(row.code) ?? []).sort(
          (a, b) =>
            (STEPS.find((s) => s.code === a)?.order ?? 0) -
            (STEPS.find((s) => s.code === b)?.order ?? 0)
        ),
        bastChoice,
      }
    })
}
