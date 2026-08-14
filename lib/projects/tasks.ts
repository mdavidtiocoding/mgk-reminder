import type { SupabaseClient } from "@supabase/supabase-js"

import { getAppThresholds } from "@/lib/app-config"
import { daysSinceWib } from "@/lib/format"
import {
  computeProjectSteps,
  getActiveComputedSteps,
  type CompletionInfo,
} from "@/lib/projects/active-steps"
import { buildProjectSearchHaystack, matchesTokenSearch } from "@/lib/search/match"
import { isUserAdmin, userHasDivision } from "@/lib/auth/user-divisions"
import { type Division, getDivisionLabel } from "@/lib/steps"
import { loadRuntimeSteps } from "@/lib/steps/runtime-config"
import {
  getNextSubstep,
  getCompletedSubstepKeys,
  getPendingReminderSubsteps,
  type SubstepCompletion,
  type SubstepDefinition,
} from "@/lib/steps/substeps"
import { loadIncomingNotesForProjects } from "@/lib/projects/incoming-notes"
import { loadSubstepCompletionsMap } from "@/lib/projects/substep-data"
import {
  resolveNoteRouteTargets,
  type IncomingStepNote,
  type NoteRouteTarget,
} from "@/lib/steps/note-route-config"
import { indexLatestReschedules } from "@/lib/projects/reschedule-log"

type StepCompletionRow = {
  step_code: string
  completed_at: string
}

type ReminderLogRow = {
  step_code: string
  sent_at: string
  channel: string
}

type ProjectRow = {
  id: string
  name: string
  status: string
  created_at: string
  ex_work_date: string | null
  etd_date: string | null
  eta_date: string | null
  mos_date: string | null
  customer: { name: string } | { name: string }[] | null
  step_completions: StepCompletionRow[]
  reminder_log: ReminderLogRow[]
}

export type MyTask = {
  projectId: string
  projectName: string
  customerName: string | null
  stepCode: string
  stepName: string
  division: Division
  divisionLabel: string
  waitingDays: number
  isHogger: boolean
  isWaitingWarning: boolean
  canComplete: boolean
  substeps: SubstepDefinition[]
  substepCompletions: SubstepCompletion[]
  nextSubstepLabel: string | null
  hasOutcome?: boolean
  checklist?: string[]
  completionMode?: import("@/lib/steps/completion-mode").StepCompletionMode
  dateInputs?: import("@/lib/steps").DateInputField[]
  outcomeRescheduleField?: import("@/lib/steps").DateField
  bastChoice?: boolean
  noteRouteTargets?: NoteRouteTarget[]
  incomingNotes?: IncomingStepNote[]
  lastRescheduleDate?: string
  lastRescheduleAt?: string
}

function normalizeCustomer(
  customer: ProjectRow["customer"]
): { name: string } | null {
  if (!customer) return null
  if (Array.isArray(customer)) return customer[0] ?? null
  return customer
}

function daysSince(date: Date): number {
  return daysSinceWib(date)
}

function isTaskForUser(
  stepDivision: Division,
  userDivisions: Division[]
): boolean {
  if (userDivisions.length === 0) return false
  return userHasDivision(userDivisions, stepDivision)
}

/** Matches the Delay badge: step already waiting 1+ hari. */
function isDelayedTask(waitingDays: number): boolean {
  return waitingDays > 0
}

export async function getMyTasks(
  supabase: SupabaseClient,
  userDivisions: Division[] = [],
  searchQuery?: string
): Promise<MyTask[]> {
  const [{ data, error }, thresholds, runtimeSteps] = await Promise.all([
    supabase
      .from("projects")
      .select(
        `
      id,
      name,
      status,
      created_at,
      ex_work_date,
      etd_date,
      eta_date,
      mos_date,
      customer:customers(name),
      step_completions(step_code, completed_at),
      reminder_log(step_code, sent_at, channel)
    `
      )
      .eq("status", "active"),
    getAppThresholds(supabase),
    loadRuntimeSteps(supabase),
  ])

  if (error) {
    throw new Error(error.message)
  }

  const projectRows = (data ?? []) as ProjectRow[]
  const projectIds = projectRows.map((project) => project.id)
  const [substepMap, incomingByProject] = await Promise.all([
    loadSubstepCompletionsMap(supabase, projectIds),
    loadIncomingNotesForProjects(supabase, projectIds, runtimeSteps),
  ])

  const tasks: MyTask[] = []
  const adminView = isUserAdmin(userDivisions)

  for (const project of projectRows) {
    const completions: CompletionInfo[] = (project.step_completions ?? []).map((c) => ({
      stepCode: c.step_code,
      completedAt: c.completed_at,
    }))

    const substepCompletions = substepMap.get(project.id) ?? []
    const rescheduleByStep = indexLatestReschedules(project.reminder_log ?? [])

    const computedSteps = computeProjectSteps(completions, {
      createdAt: project.created_at,
      ex_work_date: project.ex_work_date,
      etd_date: project.etd_date,
      eta_date: project.eta_date,
      mos_date: project.mos_date,
    }, {
      steps: runtimeSteps,
      substepCompletions,
    })

    for (const active of getActiveComputedSteps(computedSteps)) {
      const step = active.definition
      if (!isTaskForUser(step.division, userDivisions)) continue

      const waitingDays = active.unlockedAt ? daysSince(active.unlockedAt) : 0
      if (adminView && !isDelayedTask(waitingDays)) continue
      const stepSubstepCompletions = substepCompletions.filter(
        (c) => c.stepCode === step.code
      )
      const completedKeys = getCompletedSubstepKeys(step.code, substepCompletions)
      const nextSubstep = getNextSubstep(step.substeps, completedKeys)
      const reschedule = rescheduleByStep.get(step.code)

      const task: MyTask = {
        projectId: project.id,
        projectName: project.name,
        customerName: normalizeCustomer(project.customer)?.name ?? null,
        stepCode: step.code,
        stepName: step.name,
        division: step.division,
        divisionLabel: getDivisionLabel(step.division),
        waitingDays,
        isHogger: waitingDays > thresholds.hoggerDays,
        isWaitingWarning: waitingDays > thresholds.warningDays,
        canComplete: userHasDivision(userDivisions, step.division),
        substeps: step.substeps,
        substepCompletions: stepSubstepCompletions,
        nextSubstepLabel: nextSubstep?.label ?? null,
        hasOutcome: step.hasOutcome,
        checklist: step.checklist,
        completionMode: step.completionMode,
        dateInputs: step.dateInputs,
        outcomeRescheduleField: step.outcomeRescheduleField,
        bastChoice: step.bastChoice,
        noteRouteTargets: resolveNoteRouteTargets(step.noteRoute, runtimeSteps),
        incomingNotes: incomingByProject.get(project.id)?.get(step.code) ?? [],
        lastRescheduleDate: reschedule?.newExWorkDate,
        lastRescheduleAt: reschedule?.rescheduledAt,
      }

      if (searchQuery?.trim()) {
        const haystack = buildProjectSearchHaystack([
          task.projectName,
          task.customerName,
          task.stepCode,
          task.stepName,
          task.divisionLabel,
          task.nextSubstepLabel,
          ...task.substeps.map((s) => s.label),
        ])
        if (!matchesTokenSearch(haystack, searchQuery)) continue
      }

      tasks.push(task)
    }

    for (const computed of computedSteps) {
      if (adminView) continue
      if (computed.status !== "done") continue
      const step = computed.definition
      if (!isTaskForUser(step.division, userDivisions)) continue

      const completedKeys = getCompletedSubstepKeys(step.code, substepCompletions)
      const pendingReminders = getPendingReminderSubsteps(step.substeps, completedKeys)
      if (pendingReminders.length === 0) continue

      const stepCompletion = completions.find((c) => c.stepCode === step.code)
      const waitingDays = stepCompletion
        ? daysSince(new Date(stepCompletion.completedAt))
        : 0
      const stepSubstepCompletions = substepCompletions.filter(
        (c) => c.stepCode === step.code
      )
      const nextSubstep = pendingReminders[0]

      const task: MyTask = {
        projectId: project.id,
        projectName: project.name,
        customerName: normalizeCustomer(project.customer)?.name ?? null,
        stepCode: step.code,
        stepName: step.name,
        division: step.division,
        divisionLabel: getDivisionLabel(step.division),
        waitingDays,
        isHogger: waitingDays > thresholds.hoggerDays,
        isWaitingWarning: waitingDays > thresholds.warningDays,
        canComplete: userHasDivision(userDivisions, step.division),
        substeps: step.substeps,
        substepCompletions: stepSubstepCompletions,
        nextSubstepLabel: nextSubstep ? `${nextSubstep.label} (reminder)` : null,
        hasOutcome: step.hasOutcome,
        checklist: step.checklist,
        completionMode: step.completionMode,
        dateInputs: step.dateInputs,
        outcomeRescheduleField: step.outcomeRescheduleField,
        bastChoice: step.bastChoice,
        noteRouteTargets: resolveNoteRouteTargets(step.noteRoute, runtimeSteps),
        incomingNotes: incomingByProject.get(project.id)?.get(step.code) ?? [],
      }

      if (searchQuery?.trim()) {
        const haystack = buildProjectSearchHaystack([
          task.projectName,
          task.customerName,
          task.stepCode,
          task.stepName,
          task.divisionLabel,
          task.nextSubstepLabel,
          ...task.substeps.map((s) => s.label),
        ])
        if (!matchesTokenSearch(haystack, searchQuery)) continue
      }

      tasks.push(task)
    }
  }

  return tasks.sort((a, b) => b.waitingDays - a.waitingDays)
}
