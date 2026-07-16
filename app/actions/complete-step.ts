"use server"

import { revalidatePath } from "next/cache"

import { clearCalendarRemindersForStep, createStepUnlockCalendarEvents } from "@/lib/google/calendar"
import { dateToDateKeyWib } from "@/lib/format"
import { notifyDivisionForStep } from "@/lib/notifications/send"
import { computeProjectSteps, getActiveComputedSteps } from "@/lib/projects/active-steps"
import { getStep, type DateField } from "@/lib/steps"
import { createClient } from "@/lib/supabase/server"

export type CompleteStepResult =
  | { success: true }
  | { success: false; error: string }

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export type CompleteStepOptions = {
  note?: string
  dateInputs?: Partial<Record<DateField, string>>
  outcome?: "ok" | "reschedule"
  rescheduleDate?: string
  checkedItems?: string[]
}

export async function completeStep(
  projectId: string,
  stepCode: string,
  options: CompleteStepOptions = {}
): Promise<CompleteStepResult> {
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

  const step = getStep(stepCode)
  if (!step) {
    return { success: false, error: "Step tidak dikenali." }
  }

  if (profile?.division !== "admin" && profile?.division !== step.division) {
    return { success: false, error: "Anda tidak berwenang menyelesaikan step ini." }
  }

  const { data: project } = await supabase
    .from("projects")
    .select("name, status, ex_work_date, etd_date, eta_date, mos_date, created_at")
    .eq("id", projectId)
    .single()

  if (!project) {
    return { success: false, error: "Project tidak ditemukan." }
  }

  if (project.status !== "active") {
    return { success: false, error: "Project tidak aktif." }
  }

  const { data: completionRows } = await supabase
    .from("step_completions")
    .select("step_code, completed_at")
    .eq("project_id", projectId)

  const doneCodes = new Set((completionRows ?? []).map((row) => row.step_code as string))

  if (doneCodes.has(stepCode)) {
    return { success: false, error: "Step ini sudah selesai." }
  }

  const missingPrereqs = step.prerequisites.filter((code) => !doneCodes.has(code))
  if (missingPrereqs.length > 0) {
    return {
      success: false,
      error: `Step ini belum aktif. Prasyarat belum selesai: ${missingPrereqs.join(", ")}.`,
    }
  }

  if (step.checklist && step.checklist.length > 0) {
    const checked = new Set(options.checkedItems ?? [])
    const allChecked = step.checklist.every((item) => checked.has(item))
    if (!allChecked) {
      return { success: false, error: "Semua item checklist harus dicentang." }
    }
  }

  let outcome: string | null = null
  const projectUpdates: Record<string, string> = {}

  if (step.hasOutcome) {
    if (options.outcome !== "ok" && options.outcome !== "reschedule") {
      return { success: false, error: "Pilih hasil survey terlebih dahulu." }
    }
    outcome = options.outcome
    if (options.outcome === "reschedule") {
      if (!options.rescheduleDate || !DATE_PATTERN.test(options.rescheduleDate)) {
        return { success: false, error: "Tanggal reschedule tidak valid." }
      }
      projectUpdates.ex_work_date = options.rescheduleDate
    }
  }

  if (step.dateInputs && step.dateInputs.length > 0) {
    for (const input of step.dateInputs) {
      const value = options.dateInputs?.[input.field]
      if (!value || !DATE_PATTERN.test(value)) {
        return { success: false, error: `${input.label} wajib diisi dengan tanggal yang valid.` }
      }
      projectUpdates[input.field] = value
    }
  }

  if (Object.keys(projectUpdates).length > 0) {
    const { error: updateError } = await supabase
      .from("projects")
      .update(projectUpdates)
      .eq("id", projectId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }
  }

  const { error } = await supabase.from("step_completions").insert({
    project_id: projectId,
    step_code: stepCode,
    completed_by: user.id,
    note: options.note?.trim() || null,
    outcome,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  // Keep the Google Calendar event, but stop popup/alarm reminders for this step.
  await clearCalendarRemindersForStep({ projectId, stepCode })

  const beforeSteps = computeProjectSteps(
    (completionRows ?? []).map((row) => ({
      stepCode: row.step_code as string,
      completedAt: row.completed_at as string,
    })),
    {
      createdAt: project.created_at,
      ex_work_date: project.ex_work_date,
      etd_date: project.etd_date,
      eta_date: project.eta_date,
      mos_date: project.mos_date,
    }
  )
  const previouslyActiveCodes = new Set(
    getActiveComputedSteps(beforeSteps).map((s) => s.definition.code)
  )

  const afterCompletions = [
    ...(completionRows ?? []).map((row) => ({
      stepCode: row.step_code as string,
      completedAt: row.completed_at as string,
    })),
    { stepCode, completedAt: new Date().toISOString() },
  ]
  const afterSteps = computeProjectSteps(afterCompletions, {
    createdAt: project.created_at,
    ex_work_date: projectUpdates.ex_work_date ?? project.ex_work_date,
    etd_date: projectUpdates.etd_date ?? project.etd_date,
    eta_date: projectUpdates.eta_date ?? project.eta_date,
    mos_date: projectUpdates.mos_date ?? project.mos_date,
  })
  const newlyActive = getActiveComputedSteps(afterSteps).filter(
    (s) => !previouslyActiveCodes.has(s.definition.code)
  )

  // Fire notifications immediately when a step is newly unlocked.
  // This covers email + push (step_unlock) and Google Calendar.
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

  revalidatePath(`/projects/${projectId}`)
  revalidatePath("/")
  revalidatePath("/tasks")

  return { success: true }
}
