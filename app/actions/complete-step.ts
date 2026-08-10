"use server"

import { revalidatePath } from "next/cache"

import { clearCalendarRemindersForStep, createStepUnlockCalendarEvents, resyncCalendarEventsForDateField } from "@/lib/google/calendar"
import { dateToDateKeyWib } from "@/lib/format"
import { resolveActorName, writeAuditLog } from "@/lib/audit/log"
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
import { BAST2_STEP_CODES } from "@/lib/steps"
import { buildRescheduleChannel } from "@/lib/projects/reschedule-log"
import {
  resolveUserDivisions,
  userHasDivision,
} from "@/lib/auth/user-divisions"
import { createServiceClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export type CompleteStepResult =
  | { success: true; projectCompleted?: boolean }
  | { success: false; error: string }

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export type CompleteStepOptions = {
  note?: string
  dateInputs?: Partial<Record<DateField, string>>
  outcome?: "ok" | "reschedule"
  rescheduleDate?: string
  checkedItems?: string[]
  checklistItemNotes?: Record<string, string>
  /** P8 BAST: true = need BAST 2 steps; false = skip P9/A8 */
  bast2Required?: boolean
  /** Estimasi BAST (wajib jika step.bastChoice) */
  bastEstimate?: string
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
    .select("division, divisions")
    .eq("id", user.id)
    .single()

  const userDivisions = resolveUserDivisions(profile)

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

  if (!userHasDivision(userDivisions, step.division)) {
    return { success: false, error: "Anda tidak berwenang menyelesaikan step ini." }
  }

  const { data: project } = await supabase
    .from("projects")
    .select(
      "name, status, ex_work_date, etd_date, eta_date, mos_date, created_at, bast2_required"
    )
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
      return { success: false, error: "Pilih hasil (OK / Reschedule) terlebih dahulu." }
    }

    if (options.outcome === "reschedule") {
      if (!options.rescheduleDate || !DATE_PATTERN.test(options.rescheduleDate)) {
        return { success: false, error: "Tanggal reschedule tidak valid." }
      }
      const rescheduleField =
        step.outcomeRescheduleField ?? ("ex_work_date" as DateField)
      projectUpdates[rescheduleField] = options.rescheduleDate

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
        dateField: rescheduleField,
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

  if (step.bastChoice) {
    if (options.bast2Required !== true && options.bast2Required !== false) {
      return {
        success: false,
        error: "Pilih apakah ada BAST 2 atau hanya BAST 1.",
      }
    }
    if (!options.bastEstimate?.trim()) {
      return { success: false, error: "Estimasi BAST wajib diisi." }
    }
  }

  // Date inputs required when completing (not on reschedule path above)
  if (step.dateInputs && step.dateInputs.length > 0) {
    for (const input of step.dateInputs) {
      const value = options.dateInputs?.[input.field]
      if (!value || !DATE_PATTERN.test(value)) {
        return { success: false, error: `${input.label} wajib diisi dengan tanggal yang valid.` }
      }
      projectUpdates[input.field] = value
    }
  }

  const projectPatch: Record<string, unknown> = { ...projectUpdates }
  if (step.bastChoice && options.bast2Required !== undefined) {
    projectPatch.bast2_required = options.bast2Required
  }

  if (Object.keys(projectPatch).length > 0) {
    const { error: updateError } = await supabase
      .from("projects")
      .update(projectPatch)
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

  const bastNote =
    step.bastChoice && options.bastEstimate?.trim()
      ? `Estimasi BAST: ${options.bastEstimate.trim()}${
          options.bast2Required === false
            ? " · Hanya BAST 1 (BAST 2 tidak applicable)"
            : " · Ada BAST 1 & BAST 2"
        }`
      : null

  const baseNote = checklistResponses
    ? formatCompletionNote(checklistResponses, options.note)
    : options.note?.trim() || null

  const combinedNote = [baseNote, bastNote].filter(Boolean).join("\n") || null

  const { error } = await supabase.from("step_completions").insert({
    project_id: projectId,
    step_code: stepCode,
    completed_by: user.id,
    note: combinedNote,
    outcome,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  // Jika hanya BAST 1: auto-skip P9 & A8 agar project bisa selesai
  if (step.bastChoice && options.bast2Required === false) {
    const alreadyDone = new Set(completions.map((c) => c.stepCode))
    alreadyDone.add(stepCode)
    const skipRows = BAST2_STEP_CODES.filter((code) => !alreadyDone.has(code)).map(
      (code) => ({
        project_id: projectId,
        step_code: code,
        completed_by: user.id,
        note: "Dilewati otomatis — project hanya BAST 1",
        outcome: "skipped",
      })
    )
    if (skipRows.length > 0) {
      const { error: skipError } = await supabase
        .from("step_completions")
        .insert(skipRows)
      if (skipError) {
        return { success: false, error: skipError.message }
      }
    }
  }

  await clearCalendarRemindersForStep({ projectId, stepCode })

  const skipCodes =
    step.bastChoice && options.bast2Required === false
      ? [...BAST2_STEP_CODES]
      : []

  const afterCompletions = [
    ...completions,
    { stepCode, completedAt: new Date().toISOString() },
    ...skipCodes.map((code) => ({
      stepCode: code,
      completedAt: new Date().toISOString(),
    })),
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

  const { data: refreshed } = await supabase
    .from("projects")
    .select("status")
    .eq("id", projectId)
    .single()

  const projectCompleted = refreshed?.status === "completed"

  const actorName = await resolveActorName(user.id)
  await writeAuditLog({
    actorId: user.id,
    actorName,
    action: "step.complete",
    summary: `Selesai ${stepCode} · ${project.name}${
      options.bast2Required === false ? " · hanya BAST 1" : ""
    }`,
    entityType: "step",
    entityId: stepCode,
    projectId,
    meta: {
      outcome,
      bast2Required: options.bast2Required,
    },
  })

  revalidatePath(`/projects/${projectId}`)
  revalidatePath("/")
  revalidatePath("/tasks")

  return { success: true, projectCompleted }
}
