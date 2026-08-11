"use server"

import { revalidatePath } from "next/cache"

import { requirePermission } from "@/lib/auth/require-permission"
import {
  parseCompletionMode,
  validateCompletionModeConfig,
} from "@/lib/steps/completion-mode"

type StepPrereq = { code: string; prerequisites: string[] }

function wouldCreateCycle(
  stepCode: string,
  newPrerequisites: string[],
  prereqMap: Map<string, string[]>
): boolean {
  if (newPrerequisites.includes(stepCode)) return true

  const tempMap = new Map(prereqMap)
  tempMap.set(stepCode, newPrerequisites)

  function canReach(from: string, target: string, visited: Set<string>): boolean {
    if (from === target) return true
    if (visited.has(from)) return false
    visited.add(from)
    const prereqs = tempMap.get(from) ?? []
    return prereqs.some((code) => canReach(code, target, visited))
  }

  return newPrerequisites.some((code) => canReach(code, stepCode, new Set()))
}

function buildPrereqMap(steps: StepPrereq[]): Map<string, string[]> {
  return new Map(steps.map((step) => [step.code, [...step.prerequisites]]))
}

async function applyPrerequisiteUpdates(
  supabase: Awaited<ReturnType<typeof requirePermission>>["supabase"],
  updates: { code: string; prerequisites: string[] }[]
): Promise<{ success: true } | { success: false; error: string }> {
  for (const update of updates) {
    const { data, error } = await supabase
      .from("step_definitions")
      .update({ prerequisites: update.prerequisites })
      .eq("code", update.code)
      .select("code")
      .maybeSingle()

    if (error) return { success: false, error: error.message }
    if (!data) {
      return {
        success: false,
        error: "Update ditolak (jalankan database/add-flow-config-update.sql)",
      }
    }
  }

  revalidatePath("/settings/flow")
  revalidatePath("/projects/[id]", "page")
  revalidatePath("/")
  revalidatePath("/tasks")

  return { success: true }
}

export async function updateStepPrerequisites(
  stepCode: string,
  prerequisites: string[]
): Promise<{ success: true } | { success: false; error: string }> {
  const { supabase } = await requirePermission("settings_flow")

  const uniquePrerequisites = [...new Set(prerequisites)]

  const { data: allRows, error: fetchError } = await supabase
    .from("step_definitions")
    .select("code, prerequisites")

  if (fetchError) {
    return { success: false, error: fetchError.message }
  }

  const validCodes = new Set((allRows ?? []).map((row) => row.code))
  if (!validCodes.has(stepCode)) {
    return { success: false, error: "Step tidak ditemukan" }
  }

  for (const code of uniquePrerequisites) {
    if (!validCodes.has(code)) {
      return { success: false, error: `Step "${code}" tidak valid` }
    }
  }

  const allSteps: StepPrereq[] = (allRows ?? []).map((row) => ({
    code: row.code,
    prerequisites: (row.prerequisites as string[] | null) ?? [],
  }))

  const prereqMap = buildPrereqMap(allSteps)

  if (wouldCreateCycle(stepCode, uniquePrerequisites, prereqMap)) {
    return {
      success: false,
      error: "Prerequisites tidak valid (self-reference atau circular dependency)",
    }
  }

  return applyPrerequisiteUpdates(supabase, [
    { code: stepCode, prerequisites: uniquePrerequisites },
  ])
}

export async function updateStepUnlocks(
  sourceStepCode: string,
  unlocksSteps: string[]
): Promise<{ success: true } | { success: false; error: string }> {
  const { supabase } = await requirePermission("settings_flow")

  const uniqueUnlocks = [...new Set(unlocksSteps)].filter(
    (code) => code !== sourceStepCode
  )

  const { data: allRows, error: fetchError } = await supabase
    .from("step_definitions")
    .select("code, prerequisites")

  if (fetchError) {
    return { success: false, error: fetchError.message }
  }

  const validCodes = new Set((allRows ?? []).map((row) => row.code))
  if (!validCodes.has(sourceStepCode)) {
    return { success: false, error: "Step tidak ditemukan" }
  }

  for (const code of uniqueUnlocks) {
    if (!validCodes.has(code)) {
      return { success: false, error: `Step "${code}" tidak valid` }
    }
  }

  const allSteps: StepPrereq[] = (allRows ?? []).map((row) => ({
    code: row.code,
    prerequisites: (row.prerequisites as string[] | null) ?? [],
  }))

  const currentUnlocks = allSteps
    .filter((step) => step.prerequisites.includes(sourceStepCode))
    .map((step) => step.code)

  const toAdd = uniqueUnlocks.filter((code) => !currentUnlocks.includes(code))
  const toRemove = currentUnlocks.filter((code) => !uniqueUnlocks.includes(code))

  const prereqMap = buildPrereqMap(allSteps)

  for (const targetCode of toAdd) {
    const newPrerequisites = [
      ...new Set([...(prereqMap.get(targetCode) ?? []), sourceStepCode]),
    ]
    if (wouldCreateCycle(targetCode, newPrerequisites, prereqMap)) {
      return {
        success: false,
        error: `Menambah ${targetCode} akan membuat circular dependency`,
      }
    }
    prereqMap.set(targetCode, newPrerequisites)
  }

  for (const targetCode of toRemove) {
    const newPrerequisites = (prereqMap.get(targetCode) ?? []).filter(
      (code) => code !== sourceStepCode
    )
    prereqMap.set(targetCode, newPrerequisites)
  }

  const updates = allSteps
    .filter((step) => {
      const next = prereqMap.get(step.code) ?? []
      return (
        next.length !== step.prerequisites.length ||
        next.some((code, index) => code !== step.prerequisites[index])
      )
    })
    .map((step) => ({
      code: step.code,
      prerequisites: prereqMap.get(step.code) ?? [],
    }))

  if (updates.length === 0) {
    return { success: true }
  }

  return applyPrerequisiteUpdates(supabase, updates)
}

export async function updateStepCompletionConfig(
  stepCode: string,
  config: {
    completionMode: string
    checklistItems: string[]
  }
): Promise<{ success: true } | { success: false; error: string }> {
  const { supabase } = await requirePermission("settings_flow")

  const mode = parseCompletionMode(config.completionMode)
  const checklistItems = config.checklistItems.map((item) => item.trim()).filter(Boolean)

  const validationError = validateCompletionModeConfig(mode, checklistItems)
  if (validationError) {
    return { success: false, error: validationError }
  }

  const updatePayload = {
    completion_mode: mode,
    checklist_items: checklistItems.length > 0 ? checklistItems : null,
  }

  let result = await supabase
    .from("step_definitions")
    .update(updatePayload)
    .eq("code", stepCode)
    .select("code")
    .maybeSingle()

  if (result.error?.message?.includes("completion_mode")) {
    result = await supabase
      .from("step_definitions")
      .update({ checklist_items: updatePayload.checklist_items })
      .eq("code", stepCode)
      .select("code")
      .maybeSingle()
  }

  const { data, error } = result
  if (error) return { success: false, error: error.message }
  if (!data) {
    return { success: false, error: "Step tidak ditemukan" }
  }

  revalidatePath("/settings/flow")
  revalidatePath("/projects/[id]", "page")
  revalidatePath("/")
  revalidatePath("/tasks")

  return { success: true }
}

export async function updateStepSubsteps(
  stepCode: string,
  substeps: {
    key: string
    label: string
    sortOrder: number
    kind?: "required" | "reminder"
    checklist?: string[]
  }[]
): Promise<{ success: true } | { success: false; error: string }> {
  const { supabase } = await requirePermission("settings_flow")

  const normalized = substeps
    .map((substep, index) => {
      const checklist = (substep.checklist ?? [])
        .map((item) => item.trim())
        .filter(Boolean)
      return {
        key: substep.key.trim(),
        label: substep.label.trim(),
        sort_order: substep.sortOrder || index + 1,
        kind: substep.kind === "reminder" ? "reminder" : "required",
        ...(checklist.length > 0 ? { checklist_items: checklist } : {}),
      }
    })
    .filter((substep) => substep.key && substep.label)

  const keys = normalized.map((s) => s.key)
  if (new Set(keys).size !== keys.length) {
    return { success: false, error: "Key sub-step harus unik." }
  }

  const { data, error } = await supabase
    .from("step_definitions")
    .update({ substeps: normalized })
    .eq("code", stepCode)
    .select("code")
    .maybeSingle()

  if (error) return { success: false, error: error.message }
  if (!data) {
    return {
      success: false,
      error: "Update ditolak (jalankan database/add-substeps.sql)",
    }
  }

  revalidatePath("/settings/flow")
  revalidatePath("/projects/[id]", "page")
  revalidatePath("/")
  revalidatePath("/tasks")

  return { success: true }
}

export async function duplicateStepConfig(
  sourceCode: string,
  targetCode: string
): Promise<{ success: true } | { success: false; error: string }> {
  const { supabase } = await requirePermission("settings_flow")

  if (sourceCode === targetCode) {
    return { success: false, error: "Step sumber dan tujuan harus berbeda." }
  }

  const { data: rows, error: fetchError } = await supabase
    .from("step_definitions")
    .select("code, prerequisites, checklist_items, completion_mode, substeps")
    .in("code", [sourceCode, targetCode])

  if (fetchError) {
    return { success: false, error: fetchError.message }
  }

  const source = rows?.find((row) => row.code === sourceCode)
  const target = rows?.find((row) => row.code === targetCode)

  if (!source) {
    return { success: false, error: "Step sumber tidak ditemukan." }
  }
  if (!target) {
    return { success: false, error: "Step tujuan tidak ditemukan." }
  }

  const prerequisites = (source.prerequisites as string[] | null) ?? []

  const allRowsResult = await supabase
    .from("step_definitions")
    .select("code, prerequisites")

  if (allRowsResult.error) {
    return { success: false, error: allRowsResult.error.message }
  }

  const allSteps: StepPrereq[] = (allRowsResult.data ?? []).map((row) => ({
    code: row.code,
    prerequisites:
      row.code === targetCode
        ? prerequisites
        : ((row.prerequisites as string[] | null) ?? []),
  }))

  const prereqMap = buildPrereqMap(allSteps)
  if (wouldCreateCycle(targetCode, prerequisites, prereqMap)) {
    return {
      success: false,
      error: "Prerequisites hasil salin akan membuat circular dependency.",
    }
  }

  const updatePayload: Record<string, unknown> = {
    prerequisites,
    checklist_items: source.checklist_items,
    substeps: source.substeps,
  }

  if (source.completion_mode != null) {
    updatePayload.completion_mode = source.completion_mode
  }

  let result = await supabase
    .from("step_definitions")
    .update(updatePayload)
    .eq("code", targetCode)
    .select("code")
    .maybeSingle()

  if (result.error?.message?.includes("completion_mode")) {
    const { substeps, prerequisites: prereqs, checklist_items } = updatePayload
    result = await supabase
      .from("step_definitions")
      .update({ substeps, prerequisites: prereqs, checklist_items })
      .eq("code", targetCode)
      .select("code")
      .maybeSingle()
  }

  const { data, error } = result
  if (error) return { success: false, error: error.message }
  if (!data) {
    return { success: false, error: "Gagal menyalin ke step tujuan." }
  }

  revalidatePath("/settings/flow")
  revalidatePath("/projects/[id]", "page")
  revalidatePath("/")
  revalidatePath("/tasks")

  return { success: true }
}

export async function resetStepConfig(
  stepCode: string
): Promise<{ success: true } | { success: false; error: string }> {
  const { supabase } = await requirePermission("settings_flow")
  const { getStep } = await import("@/lib/steps")
  const { inferCompletionMode } = await import("@/lib/steps/completion-mode")

  const stepDef = getStep(stepCode)
  if (!stepDef) {
    return { success: false, error: "Step tidak ditemukan di workflow bawaan." }
  }

  const checklist = stepDef.checklist ?? []
  const completionMode = inferCompletionMode(checklist, stepDef.completionMode ?? null)

  const updatePayload: Record<string, unknown> = {
    prerequisites: stepDef.prerequisites,
    checklist_items: checklist.length > 0 ? checklist : null,
    substeps: null,
    completion_mode: completionMode,
  }

  let result = await supabase
    .from("step_definitions")
    .update(updatePayload)
    .eq("code", stepCode)
    .select("code")
    .maybeSingle()

  if (result.error?.message?.includes("completion_mode")) {
    result = await supabase
      .from("step_definitions")
      .update({
        prerequisites: stepDef.prerequisites,
        checklist_items: updatePayload.checklist_items,
        substeps: null,
      })
      .eq("code", stepCode)
      .select("code")
      .maybeSingle()
  }

  const { data, error } = result
  if (error) return { success: false, error: error.message }
  if (!data) {
    return { success: false, error: "Step tidak ditemukan." }
  }

  revalidatePath("/settings/flow")
  revalidatePath("/projects/[id]", "page")
  revalidatePath("/")
  revalidatePath("/tasks")

  return { success: true }
}

export async function updateStepTriggerConfig(
  stepCode: string,
  trigger: Record<string, unknown>
): Promise<{ success: true } | { success: false; error: string }> {
  const { supabase } = await requirePermission("settings_flow")

  const { parseTriggerConfig } = await import("@/lib/steps/trigger-config")
  const parsed = parseTriggerConfig(trigger)
  if (!parsed) {
    return { success: false, error: "Konfigurasi trigger tidak valid." }
  }

  const result = await supabase
    .from("step_definitions")
    .update({ trigger_config: parsed })
    .eq("code", stepCode)
    .select("code")
    .maybeSingle()

  if (result.error) {
    return {
      success: false,
      error: result.error.message.includes("trigger_config")
        ? "Kolom trigger_config belum ada ? jalankan database/add-trigger-and-bast-config.sql"
        : result.error.message,
    }
  }
  if (!result.data) {
    return { success: false, error: "Step tidak ditemukan." }
  }

  revalidatePath("/settings/flow")
  revalidatePath("/projects/[id]", "page")
  revalidatePath("/")
  revalidatePath("/tasks")

  return { success: true }
}

export async function updateStepBastChoice(
  stepCode: string,
  bastChoice: boolean
): Promise<{ success: true } | { success: false; error: string }> {
  const { supabase } = await requirePermission("settings_flow")

  const result = await supabase
    .from("step_definitions")
    .update({ bast_choice: bastChoice })
    .eq("code", stepCode)
    .select("code")
    .maybeSingle()

  if (result.error) {
    return {
      success: false,
      error: result.error.message.includes("bast_choice")
        ? "Kolom bast_choice belum ada - jalankan database/add-bast-choice-config.sql"
        : result.error.message,
    }
  }
  if (!result.data) {
    return { success: false, error: "Step tidak ditemukan." }
  }

  revalidatePath("/settings/flow")
  revalidatePath("/projects/[id]", "page")
  revalidatePath("/")
  revalidatePath("/tasks")

  return { success: true }
}

export async function updateStepOutcomeConfig(
  stepCode: string,
  config: {
    hasOutcome: boolean
    outcomeRescheduleField: string | null
  }
): Promise<{ success: true } | { success: false; error: string }> {
  const { supabase } = await requirePermission("settings_flow")

  const DATE_FIELDS = new Set([
    "ex_work_date",
    "etd_date",
    "eta_date",
    "mos_date",
  ])
  const field =
    config.hasOutcome &&
    config.outcomeRescheduleField &&
    DATE_FIELDS.has(config.outcomeRescheduleField)
      ? config.outcomeRescheduleField
      : null

  const result = await supabase
    .from("step_definitions")
    .update({
      has_outcome: config.hasOutcome,
      outcome_reschedule_field: field,
    })
    .eq("code", stepCode)
    .select("code")
    .maybeSingle()

  if (result.error) {
    return {
      success: false,
      error: result.error.message.includes("has_outcome")
        ? "Kolom has_outcome belum ada - jalankan database/add-trigger-and-bast-config.sql"
        : result.error.message,
    }
  }
  if (!result.data) {
    return { success: false, error: "Step tidak ditemukan." }
  }

  revalidatePath("/settings/flow")
  revalidatePath("/projects/[id]", "page")
  revalidatePath("/")
  revalidatePath("/tasks")

  return { success: true }
}

export async function updateStepNoteRouteConfig(
  stepCode: string,
  config: { enabled: boolean; targets: string[] }
): Promise<{ success: true } | { success: false; error: string }> {
  const { supabase } = await requirePermission("settings_flow")

  const targets = [...new Set(config.targets.map((code) => code.trim()).filter(Boolean))]
  const enabled = config.enabled && targets.length > 0
  if (targets.includes(stepCode)) {
    return {
      success: false,
      error: "Step tujuan tidak boleh step yang sama.",
    }
  }

  const payload = enabled ? { enabled: true, targets } : { enabled: false, targets }

  const result = await supabase
    .from("step_definitions")
    .update({ note_route_config: payload })
    .eq("code", stepCode)
    .select("code")
    .maybeSingle()

  if (result.error) {
    return {
      success: false,
      error: result.error.message.includes("note_route_config")
        ? "Kolom note_route_config belum ada - jalankan database/add-note-route-config.sql"
        : result.error.message,
    }
  }
  if (!result.data) {
    return { success: false, error: "Step tidak ditemukan." }
  }

  revalidatePath("/settings/flow")
  revalidatePath("/projects/[id]", "page")
  revalidatePath("/")
  revalidatePath("/tasks")

  return { success: true }
}
