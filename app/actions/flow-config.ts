"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/auth/require-admin"

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
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
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
  const { supabase } = await requireAdmin()

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
  const { supabase } = await requireAdmin()

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

export async function updateStepSubsteps(
  stepCode: string,
  substeps: { key: string; label: string; sortOrder: number }[]
): Promise<{ success: true } | { success: false; error: string }> {
  const { supabase } = await requireAdmin()

  const normalized = substeps
    .map((substep, index) => ({
      key: substep.key.trim(),
      label: substep.label.trim(),
      sort_order: substep.sortOrder || index + 1,
    }))
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
