"use server"

import { revalidatePath } from "next/cache"

import {
  buildDoneCodes,
  computeProjectSteps,
} from "@/lib/projects/active-steps"
import { loadRuntimeSteps } from "@/lib/steps/runtime-config"
import { loadSubstepCompletionsForProject } from "@/lib/projects/substep-data"
import { createClient } from "@/lib/supabase/server"

export type UndoStepResult =
  | { success: true }
  | { success: false; error: string }

export async function undoStep(
  projectId: string,
  stepCode: string
): Promise<UndoStepResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Silakan login terlebih dahulu." }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("division")
    .eq("id", user.id)
    .single()

  const [runtimeSteps, substepCompletions, { data: project }] = await Promise.all([
    loadRuntimeSteps(supabase),
    loadSubstepCompletionsForProject(supabase, projectId),
    supabase
      .from("projects")
      .select(
        `
        id,
        status,
        created_at,
        ex_work_date,
        etd_date,
        eta_date,
        mos_date,
        step_completions(step_code, completed_at, completed_by)
      `
      )
      .eq("id", projectId)
      .single(),
  ])

  if (!project) {
    return { success: false, error: "Project tidak ditemukan." }
  }

  if (profile?.division !== "admin") {
    return { success: false, error: "Hanya admin yang bisa membatalkan step selesai." }
  }

  const step = runtimeSteps.find((s) => s.code === stepCode)
  if (!step) {
    return { success: false, error: "Step tidak dikenali." }
  }

  const completions = (project.step_completions ?? []).map((row) => ({
    stepCode: row.step_code as string,
    completedAt: row.completed_at as string,
  }))

  const doneCodes = buildDoneCodes(completions, substepCompletions, runtimeSteps)
  if (!doneCodes.has(stepCode)) {
    return { success: false, error: "Step ini belum selesai." }
  }

  const blockedDependents = runtimeSteps.filter((candidate) => {
    if (!candidate.prerequisites.includes(stepCode)) return false
    if (doneCodes.has(candidate.code)) return true
    return substepCompletions.some((c) => c.stepCode === candidate.code)
  })

  if (blockedDependents.length > 0) {
    return {
      success: false,
      error: `Batalkan step berikut terlebih dahulu: ${blockedDependents.map((s) => s.code).join(", ")}.`,
    }
  }

  const { error: deleteSubstepsError } = await supabase
    .from("step_substep_completions")
    .delete()
    .eq("project_id", projectId)
    .eq("step_code", stepCode)

  if (deleteSubstepsError) {
    return { success: false, error: deleteSubstepsError.message }
  }

  const { error: deleteStepError } = await supabase
    .from("step_completions")
    .delete()
    .eq("project_id", projectId)
    .eq("step_code", stepCode)

  if (deleteStepError) {
    return { success: false, error: deleteStepError.message }
  }

  if (project.status === "completed") {
    const afterCompletions = completions.filter((c) => c.stepCode !== stepCode)
    const afterSteps = computeProjectSteps(afterCompletions, {
      createdAt: project.created_at,
      ex_work_date: project.ex_work_date,
      etd_date: project.etd_date,
      eta_date: project.eta_date,
      mos_date: project.mos_date,
    }, {
      steps: runtimeSteps,
      substepCompletions: substepCompletions.filter((c) => c.stepCode !== stepCode),
    })

    const stillComplete = afterSteps.every((s) => s.status === "done")
    if (!stillComplete) {
      await supabase
        .from("projects")
        .update({ status: "active" })
        .eq("id", projectId)
    }
  }

  revalidatePath(`/projects/${projectId}`)
  revalidatePath("/")
  revalidatePath("/tasks")

  return { success: true }
}
