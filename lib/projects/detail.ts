import type { SupabaseClient } from "@supabase/supabase-js"

import { userHasDivision, isUserAdmin } from "@/lib/auth/user-divisions"
import { computeProjectSteps, type CompletionInfo } from "@/lib/projects/active-steps"
import { buildStepFlowWarnings } from "@/lib/projects/flow-warnings"
import {
  type DateField,
  type DateInputField,
  type Division,
  getDivisionLabel,
  type ProjectStatus,
  STAGE_LABELS,
  TOTAL_STAGE_COUNT,
  TOTAL_STEP_COUNT,
} from "@/lib/steps"
import { loadRuntimeSteps } from "@/lib/steps/runtime-config"
import type { StepCompletionMode } from "@/lib/steps/completion-mode"
import type { SubstepCompletion, SubstepDefinition } from "@/lib/steps/substeps"
import {
  getCompletedSubstepKeys,
  getPendingReminderSubsteps,
} from "@/lib/steps/substeps"
import { loadSubstepCompletionsForProject } from "@/lib/projects/substep-data"
import { indexLatestReschedules, isRescheduleChannel } from "@/lib/projects/reschedule-log"

type CompletionRow = {
  step_code: string
  completed_at: string
  completed_by: string
  note: string | null
  outcome: string | null
  profile: { name: string } | { name: string }[] | null
}

type ReminderRow = {
  step_code: string
  sent_at: string
  channel: string
}

type FollowUpRow = {
  step_code: string
  scheduled_date: string
  scheduled_time: string
  note: string | null
}

type ProjectDetailRow = {
  id: string
  name: string
  status: ProjectStatus
  created_at: string
  customer_id: string | null
  ex_work_date: string | null
  etd_date: string | null
  eta_date: string | null
  mos_date: string | null
  customer: { name: string } | { name: string }[] | null
  step_completions: CompletionRow[]
  reminder_log: ReminderRow[]
  followup_schedule: FollowUpRow[]
}

export type StepStatus = "done" | "active" | "locked"

export type StepTimelineItem = {
  code: string
  order: number
  name: string
  division: Division
  divisionLabel: string
  stage: number
  status: StepStatus
  prerequisites: string[]
  completedAt?: string
  completedByName?: string
  note?: string | null
  outcome?: string | null
  lastReminderAt?: string
  followUpDate?: string
  followUpTime?: string
  followUpNote?: string | null
  lastRescheduleDate?: string
  lastRescheduleAt?: string
  checklist?: string[]
  completionMode?: StepCompletionMode
  dateInputs?: DateInputField[]
  hasOutcome?: boolean
  outcomeRescheduleField?: import("@/lib/steps").DateField
  bastChoice?: boolean
  substeps: SubstepDefinition[]
  substepCompletions: SubstepCompletion[]
  canComplete: boolean
  canEditSubsteps: boolean
  canUndo: boolean
  hasPendingReminderSubsteps: boolean
  /** Step sebelumnya / prasyarat belum selesai padahal step ini sudah berjalan. */
  flowWarnings: string[]
}

export type ProjectDetail = {
  id: string
  name: string
  status: ProjectStatus
  createdAt: string
  customerId: string | null
  customerName: string | null
  exWorkDate: string | null
  etdDate: string | null
  etaDate: string | null
  mosDate: string | null
  steps: StepTimelineItem[]
  doneCount: number
  totalCount: number
  currentStage: number
  totalStages: number
  currentStageLabel: string
}

function normalizeRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

function canUserCompleteStep(
  userDivisions: Division[],
  stepDivision: Division
): boolean {
  return userHasDivision(userDivisions, stepDivision)
}

export async function getProjectDetail(
  supabase: SupabaseClient,
  projectId: string,
  userDivisions: Division[] = []
): Promise<ProjectDetail | null> {
  const [runtimeSteps, substepCompletions, { data, error }] = await Promise.all([
    loadRuntimeSteps(supabase),
    loadSubstepCompletionsForProject(supabase, projectId),
    supabase
      .from("projects")
      .select(
        `
      id,
      name,
      status,
      created_at,
      customer_id,
      ex_work_date,
      etd_date,
      eta_date,
      mos_date,
      customer:customers(name),
      step_completions(
        step_code,
        completed_at,
        completed_by,
        note,
        outcome,
        profile:profiles(name)
      ),
      reminder_log(step_code, sent_at, channel),
      followup_schedule(step_code, scheduled_date, scheduled_time, note)
    `
      )
      .eq("id", projectId)
      .single(),
  ])

  if (error || !data) return null

  const project = data as ProjectDetailRow

  const completionByCode = new Map<string, CompletionRow>()
  for (const completion of project.step_completions ?? []) {
    completionByCode.set(completion.step_code, completion)
  }

  const lastReminderByStep = new Map<string, string>()
  for (const log of project.reminder_log ?? []) {
    if (isRescheduleChannel(log.channel)) continue
    const existing = lastReminderByStep.get(log.step_code)
    if (!existing || log.sent_at > existing) {
      lastReminderByStep.set(log.step_code, log.sent_at)
    }
  }

  const lastRescheduleByStep = indexLatestReschedules(project.reminder_log ?? [])

  const followUpByStep = new Map<string, FollowUpRow>()
  for (const followUp of project.followup_schedule ?? []) {
    followUpByStep.set(followUp.step_code, followUp)
  }

  const completions: CompletionInfo[] = (project.step_completions ?? []).map((c) => ({
    stepCode: c.step_code,
    completedAt: c.completed_at,
    note: c.note,
    outcome: c.outcome,
  }))

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

  const steps: StepTimelineItem[] = computedSteps.map((computed) => {
    const step = computed.definition
    const completion = completionByCode.get(step.code)
    const followUp = followUpByStep.get(step.code)
    const reschedule = lastRescheduleByStep.get(step.code)
    const stepSubstepCompletions = substepCompletions.filter(
      (c) => c.stepCode === step.code
    )
    const completedSubstepKeys = getCompletedSubstepKeys(step.code, substepCompletions)
    const pendingReminders = getPendingReminderSubsteps(step.substeps, completedSubstepKeys)
    const userCanCompleteStep =
      project.status === "active" && canUserCompleteStep(userDivisions, step.division)

    return {
      code: step.code,
      order: step.order,
      name: step.name,
      division: step.division,
      divisionLabel: getDivisionLabel(step.division),
      stage: step.stage,
      status: computed.status,
      prerequisites: step.prerequisites,
      completedAt: completion?.completed_at ?? computed.completion?.completedAt,
      completedByName: normalizeRelation(completion?.profile ?? null)?.name,
      note: completion?.note,
      outcome: completion?.outcome,
      lastReminderAt:
        computed.status === "active" ? lastReminderByStep.get(step.code) : undefined,
      followUpDate: followUp?.scheduled_date,
      followUpTime: followUp?.scheduled_time ?? "09:00:00",
      followUpNote: followUp?.note,
      lastRescheduleDate: reschedule?.newExWorkDate,
      lastRescheduleAt: reschedule?.rescheduledAt,
      checklist: step.checklist,
      completionMode: step.completionMode,
      dateInputs: step.dateInputs,
      hasOutcome: step.hasOutcome,
      outcomeRescheduleField: step.outcomeRescheduleField,
      bastChoice: step.bastChoice,
      substeps: step.substeps,
      substepCompletions: stepSubstepCompletions,
      canComplete: computed.status === "active" && userCanCompleteStep,
      canEditSubsteps:
        userCanCompleteStep &&
        (computed.status === "active" || pendingReminders.length > 0),
      canUndo: computed.status === "done" && isUserAdmin(userDivisions),
      hasPendingReminderSubsteps: pendingReminders.length > 0,
      flowWarnings: [],
    }
  })

  const stepSnapshots = steps.map((s) => ({
    code: s.code,
    order: s.order,
    status: s.status,
    prerequisites: s.prerequisites,
  }))

  for (const timelineStep of steps) {
    timelineStep.flowWarnings = buildStepFlowWarnings(
      {
        code: timelineStep.code,
        order: timelineStep.order,
        status: timelineStep.status,
        prerequisites: timelineStep.prerequisites,
        substepCompletionCount: timelineStep.substepCompletions.length,
      },
      stepSnapshots
    )
  }

  const doneCount = steps.filter((s) => s.status === "done").length
  const activeStages = steps
    .filter((s) => s.status === "active")
    .map((s) => s.stage)

  const currentStage =
    project.status === "completed"
      ? TOTAL_STAGE_COUNT
      : activeStages.length > 0
        ? Math.min(...activeStages)
        : 1

  return {
    id: project.id,
    name: project.name,
    status: project.status,
    createdAt: project.created_at,
    customerId: project.customer_id,
    customerName: normalizeRelation(project.customer)?.name ?? null,
    exWorkDate: project.ex_work_date,
    etdDate: project.etd_date,
    etaDate: project.eta_date,
    mosDate: project.mos_date,
    steps,
    doneCount,
    totalCount: TOTAL_STEP_COUNT,
    currentStage,
    totalStages: TOTAL_STAGE_COUNT,
    currentStageLabel: STAGE_LABELS[currentStage] ?? "",
  }
}

export type { DateField }
