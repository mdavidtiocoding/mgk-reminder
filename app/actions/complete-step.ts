"use server"

import { revalidatePath } from "next/cache"

import { clearCalendarRemindersForStep, createStepUnlockCalendarEvents, resyncCalendarEventsForDateField } from "@/lib/google/calendar"
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
  buildChecklistResponses,
  formatCompletionNote,
  validateChecklistResponses,
  type ChecklistItemResponse,
} from "@/lib/steps/checklist-response"
import {
  requiresChecklist,
  requiresKeterangan,
} from "@/lib/steps/completion-mode"
import type { DateField } from "@/lib/steps"
import { buildRescheduleChannel } from "@/lib/projects/reschedule-log"
import { createServiceClient } from "@/lib/supabase/admin"
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
  checklistItemNotes?: Record<string, string>
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

  const runtimeSteps = await loadRuntimeSteps(supabase)
  const step = runtimeSteps.find((s) => s.code === stepCode)
  if (!step) {
    return { success: false, error: "Step tidak dikenali." }
  }

  if (step.substeps.length > 0) {
    return {
      success: false,
      error: "Step ini memakai sub-step. Gunakan tombol sub-step di timeline.",
    }
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

  if (doneCodes.has(stepCode)) {
    return { success: false, error: "Step ini sudah selesai." }
  }

  if (!isStepActiveForFlow(step, doneCodes)) {
    const missingPrereqs = step.prerequisites.filter((code) => !doneCodes.has(code))
    return {
      success: false,
      error: `Step ini belum aktif. Prasyarat belum selesai: ${missingPrereqs.join(", ")}.`,
    }
  }

  const completionMode = step.completionMode ?? "normal"

  let checklistResponses: ChecklistItemResponse[] | undefined

  const validateChecklist = (items: string[]) => {
    const responses = buildChecklistResponses(
      items,
      options.checkedItems ?? [],
      options.checklistItemNotes ?? {}
    )
    const checklistError = validateChecklistResponses(items, responses)
    if (checklistError) {
      return { success: false as const, error: checklistError }
    }
    checklistResponses = responses
    return null
  }

  if (requiresChecklist(completionMode)) {
    if (!step.checklist || step.checklist.length === 0) {
      return {
        success: false,
        error: "Step checklist belum dikonfigurasi di Flow Config.",
      }
    }
    const checklistError = validateChecklist(step.checklist)
    if (checklistError) return checklistError
  } else if (step.checklist && step.checklist.length > 0) {
    const checklistError = validateChecklist(step.checklist)
    if (checklistError) return checklistError
  }

  if (requiresKeterangan(completionMode)) {
    if (!options.note?.trim()) {
      return { success: false, error: "Keterangan wajib diisi." }
    }
  }

  let outcome: string | null = null
  const projectUpdates: Record<string, string> = {}

  if (step.hasOutcome) {
    if (options.outcome !== "ok" && options.outcome !== "reschedule") {
      return { success: false, error: "Pilih hasil survey terlebih dahulu." }
    }

    if (options.outcome === "reschedule") {
      if (!options.rescheduleDate || !DATE_PATTERN.test(options.rescheduleDate)) {
        return { success: false, error: "Tanggal reschedule tidak valid." }
      }
      projectUpdates.ex_work_date = options.rescheduleDate

      if (Object.keys(projectUpdates).length > 0) {
        const { error: updateError } = await supabase
          .from("projects")
          .update(projectUpdates)
          .eq("id", projectId)

        if (updateError) {
          return { success: false, error: updateError.message }
        }
      }

      const service = createServiceClient()
      if (service) {
        await service.from("reminder_log").insert({
          project_id: projectId,
          step_code: stepCode,
          channel: buildRescheduleChannel(options.rescheduleDate),
        })
      }

      await resyncCalendarEventsForDateField({
        projectId,
        dateField: "ex_work_date",
        actingUserId: user.id,
        newDateValue: options.rescheduleDate,
      })

      revalidatePath(`/projects/${projectId}`)
      revalidatePath("/")
      revalidatePath("/tasks")

      return { success: true }
    }

    outcome = options.outcome
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

  const projectDates = {
    createdAt: project.created_at,
    ex_work_date: projectUpdates.ex_work_date ?? project.ex_work_date,
    etd_date: projectUpdates.etd_date ?? project.etd_date,
    eta_date: projectUpdates.eta_date ?? project.eta_date,
    mos_date: projectUpdates.mos_date ?? project.mos_date,
  }

  const beforeSteps = computeProjectSteps(completions, projectDates, {
    steps: runtimeSteps,
    substepCompletions,
  })
  const previouslyActiveCodes = new Set(
    getActiveComputedSteps(beforeSteps).map((s) => s.definition.code)
  )

  const { error } = await supabase.from("step_completions").insert({
    project_id: projectId,
    step_code: stepCode,
    completed_by: user.id,
    note: checklistResponses
      ? formatCompletionNote(checklistResponses, options.note)
      : options.note?.trim() || null,
    outcome,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  await clearCalendarRemindersForStep({ projectId, stepCode })

  const afterCompletions = [
    ...completions,
    { stepCode, completedAt: new Date().toISOString() },
  ]
  const afterSteps = computeProjectSteps(afterCompletions, projectDates, {
    steps: runtimeSteps,
    substepCompletions,
  })
  const newlyActive = getActiveComputedSteps(afterSteps).filter(
    (s) => !previouslyActiveCodes.has(s.definition.code)
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

  revalidatePath(`/projects/${projectId}`)
  revalidatePath("/")
  revalidatePath("/tasks")

  return { success: true }
}
