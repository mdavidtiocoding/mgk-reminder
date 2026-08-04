"use server"

import { revalidatePath } from "next/cache"

import { clearCalendarRemindersForStep, createStepUnlockCalendarEvents } from "@/lib/google/calendar"
import { dateToDateKeyWib } from "@/lib/format"
import { notifyDivisionForStep } from "@/lib/notifications/send"
import {
  buildDoneCodes,
  computeProjectSteps,
  getActiveComputedSteps,
  isStepActiveForFlow,
} from "@/lib/projects/active-steps"
import { loadRuntimeSteps } from "@/lib/steps/runtime-config"
import {
  areRequiredSubstepsComplete,
  canCompleteSubstepNow,
  getCompletedSubstepKeys,
  getSubstepKind,
} from "@/lib/steps/substeps"
import {
  isUserAdmin,
  resolveUserDivisions,
  userHasDivision,
} from "@/lib/auth/user-divisions"
import { createClient } from "@/lib/supabase/server"

export type SubstepActionResult =
  | { success: true }
  | { success: false; error: string }

export async function completeSubstep(
  projectId: string,
  stepCode: string,
  substepKey: string,
  options?: { note?: string; eventDate?: string }
): Promise<SubstepActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Silakan login terlebih dahulu." }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("division, divisions")
    .eq("id", user.id)
    .single()

  const userDivisions = resolveUserDivisions(profile)

  const runtimeSteps = await loadRuntimeSteps(supabase)
  const step = runtimeSteps.find((s) => s.code === stepCode)
  if (!step) {
    return { success: false, error: "Step tidak dikenali." }
  }

  if (step.substeps.length === 0) {
    return { success: false, error: "Step ini tidak punya sub-step." }
  }

  const substep = step.substeps.find((s) => s.key === substepKey)
  if (!substep) {
    return { success: false, error: "Sub-step tidak dikenali." }
  }

  if (!userHasDivision(userDivisions, step.division)) {
    return { success: false, error: "Anda tidak berwenang menyelesaikan step ini." }
  }

  const { data: project } = await supabase
    .from("projects")
    .select("name, status, created_at, ex_work_date, etd_date, eta_date, mos_date")
    .eq("id", projectId)
    .single()

  if (!project) {
    return { success: false, error: "Project tidak ditemukan." }
  }

  if (project.status !== "active") {
    return { success: false, error: "Project tidak aktif." }
  }

  const [{ data: completionRows }, { data: substepRows }] = await Promise.all([
    supabase
      .from("step_completions")
      .select("step_code, completed_at")
      .eq("project_id", projectId),
    supabase
      .from("step_substep_completions")
      .select("step_code, substep_key, completed_at")
      .eq("project_id", projectId),
  ])

  const completions = (completionRows ?? []).map((row) => ({
    stepCode: row.step_code as string,
    completedAt: row.completed_at as string,
  }))

  const substepCompletions = (substepRows ?? []).map((row) => ({
    stepCode: row.step_code as string,
    substepKey: row.substep_key as string,
    completedAt: row.completed_at as string,
  }))

  const doneCodes = buildDoneCodes(completions, substepCompletions, runtimeSteps)
  const completedKeys = getCompletedSubstepKeys(stepCode, substepCompletions)
  const substepKind = getSubstepKind(substep)
  const stepFlowDone = doneCodes.has(stepCode)

  if (completedKeys.has(substepKey)) {
    return { success: false, error: "Sub-step ini sudah selesai." }
  }

  if (!canCompleteSubstepNow(substep, step.substeps, completedKeys)) {
    return { success: false, error: "Selesaikan sub-step wajib sebelumnya terlebih dahulu." }
  }

  if (substepKind === "required") {
    if (!isStepActiveForFlow(step, doneCodes)) {
      return { success: false, error: "Step ini belum aktif." }
    }
  } else if (!isStepActiveForFlow(step, doneCodes) && !stepFlowDone) {
    return { success: false, error: "Step ini belum aktif." }
  }

  const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
  let eventDate: string | null = null
  if (options?.eventDate) {
    if (!DATE_PATTERN.test(options.eventDate)) {
      return { success: false, error: "Tanggal kejadian tidak valid." }
    }
    eventDate = options.eventDate
  }

  const insertPayload = {
    project_id: projectId,
    step_code: stepCode,
    substep_key: substepKey,
    completed_by: user.id,
    note: options?.note?.trim() || null,
    ...(eventDate ? { event_date: eventDate } : {}),
  }

  let insertError = (
    await supabase.from("step_substep_completions").insert(insertPayload)
  ).error

  if (insertError && eventDate) {
    const retry = await supabase.from("step_substep_completions").insert({
      project_id: projectId,
      step_code: stepCode,
      substep_key: substepKey,
      completed_by: user.id,
      note: options?.note?.trim() || null,
    })
    insertError = retry.error
  }

  if (insertError) {
    return { success: false, error: insertError.message }
  }

  const updatedSubsteps = [
    ...substepCompletions,
    {
      stepCode,
      substepKey,
      completedAt: new Date().toISOString(),
    },
  ]

  const requiredDone = areRequiredSubstepsComplete(
    step.substeps,
    getCompletedSubstepKeys(stepCode, updatedSubsteps)
  )

  if (requiredDone && substepKind === "required") {
    const projectDates = {
      createdAt: project.created_at,
      ex_work_date: project.ex_work_date,
      etd_date: project.etd_date,
      eta_date: project.eta_date,
      mos_date: project.mos_date,
    }

    const beforeSteps = computeProjectSteps(completions, projectDates, {
      steps: runtimeSteps,
      substepCompletions,
    })
    const previouslyActive = new Set(
      getActiveComputedSteps(beforeSteps).map((s) => s.definition.code)
    )

    const stepAlreadyRecorded = completions.some((c) => c.stepCode === stepCode)

    if (!stepAlreadyRecorded) {
      const { error: stepDoneError } = await supabase.from("step_completions").insert({
        project_id: projectId,
        step_code: stepCode,
        completed_by: user.id,
        note: options?.note?.trim() || null,
      })

      if (stepDoneError) {
        await supabase
          .from("step_substep_completions")
          .delete()
          .eq("project_id", projectId)
          .eq("step_code", stepCode)
          .eq("substep_key", substepKey)

        return { success: false, error: stepDoneError.message }
      }
    }

    await clearCalendarRemindersForStep({ projectId, stepCode })

    const afterSubsteps = [
      ...substepCompletions,
      { stepCode, substepKey, completedAt: new Date().toISOString() },
    ]
    const afterCompletions = stepAlreadyRecorded
      ? completions
      : [
          ...completions,
          { stepCode, completedAt: new Date().toISOString() },
        ]
    const afterSteps = computeProjectSteps(afterCompletions, projectDates, {
      steps: runtimeSteps,
      substepCompletions: afterSubsteps,
    })
    const newlyActive = getActiveComputedSteps(afterSteps).filter(
      (s) => !previouslyActive.has(s.definition.code)
    )

    for (const activeStep of newlyActive) {
      await notifyDivisionForStep({
        projectId,
        projectName: project.name,
        stepCode: activeStep.definition.code,
        type: "step_unlock",
      })
      await createStepUnlockCalendarEvents({
        projectId,
        stepCode: activeStep.definition.code,
        actingUserId: user.id,
        eventDate: activeStep.triggerAt ? dateToDateKeyWib(activeStep.triggerAt) : undefined,
      })
    }
  }

  revalidatePath(`/projects/${projectId}`)
  revalidatePath("/")
  revalidatePath("/tasks")

  return { success: true }
}

export async function undoSubstep(
  projectId: string,
  stepCode: string,
  substepKey: string
): Promise<SubstepActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Silakan login terlebih dahulu." }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("division, divisions")
    .eq("id", user.id)
    .single()

  const userDivisions = resolveUserDivisions(profile)

  const runtimeSteps = await loadRuntimeSteps(supabase)
  const step = runtimeSteps.find((s) => s.code === stepCode)
  if (!step || step.substeps.length === 0) {
    return { success: false, error: "Step tidak punya sub-step." }
  }

  if (!userHasDivision(userDivisions, step.division)) {
    return { success: false, error: "Anda tidak berwenang mengubah step ini." }
  }

  const { data: substepRows } = await supabase
    .from("step_substep_completions")
    .select("substep_key, completed_by")
    .eq("project_id", projectId)
    .eq("step_code", stepCode)

  const substep = step.substeps.find((s) => s.key === substepKey)
  if (!substep) {
    return { success: false, error: "Sub-step tidak dikenali." }
  }

  const completedKeys = new Set((substepRows ?? []).map((row) => row.substep_key as string))
  if (!completedKeys.has(substepKey)) {
    return { success: false, error: "Sub-step belum selesai." }
  }

  const substepIndex = step.substeps.findIndex((s) => s.key === substepKey)
  const hasLaterDoneRequired = step.substeps
    .slice(substepIndex + 1)
    .some((s) => getSubstepKind(s) === "required" && completedKeys.has(s.key))

  if (hasLaterDoneRequired) {
    return {
      success: false,
      error: "Batalkan sub-step wajib berikutnya terlebih dahulu.",
    }
  }

  const row = (substepRows ?? []).find((r) => r.substep_key === substepKey)
  if (
    !isUserAdmin(userDivisions) &&
    row?.completed_by !== user.id
  ) {
    return { success: false, error: "Hanya yang menyelesaikan atau admin yang bisa undo." }
  }

  const { error: deleteSubstepError } = await supabase
    .from("step_substep_completions")
    .delete()
    .eq("project_id", projectId)
    .eq("step_code", stepCode)
    .eq("substep_key", substepKey)

  if (deleteSubstepError) {
    return { success: false, error: deleteSubstepError.message }
  }

  if (getSubstepKind(substep) === "required") {
    await supabase
      .from("step_completions")
      .delete()
      .eq("project_id", projectId)
      .eq("step_code", stepCode)
  }

  revalidatePath(`/projects/${projectId}`)
  revalidatePath("/")
  revalidatePath("/tasks")

  return { success: true }
}
