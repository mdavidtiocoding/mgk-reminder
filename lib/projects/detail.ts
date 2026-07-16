import type { SupabaseClient } from "@supabase/supabase-js"

import { computeProjectSteps, type CompletionInfo } from "@/lib/projects/active-steps"
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

type CompletionRow = {
  step_code: string
  completed_at: string
  note: string | null
  outcome: string | null
  profile: { name: string } | { name: string }[] | null
}

type ReminderRow = {
  step_code: string
  sent_at: string
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
  checklist?: string[]
  dateInputs?: DateInputField[]
  hasOutcome?: boolean
  canComplete: boolean
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
  userDivision: Division | null | undefined,
  stepDivision: Division
): boolean {
  if (!userDivision) return false
  return userDivision === "admin" || userDivision === stepDivision
}

export async function getProjectDetail(
  supabase: SupabaseClient,
  projectId: string,
  userDivision?: Division | null
): Promise<ProjectDetail | null> {
  const [{ data, error }, { data: stepDefRows }] = await Promise.all([
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
        note,
        outcome,
        profile:profiles(name)
      ),
      reminder_log(step_code, sent_at),
      followup_schedule(step_code, scheduled_date, scheduled_time, note)
    `
      )
      .eq("id", projectId)
      .single(),
    // Step names are admin-editable in Settings → Reminder Config; the
    // rest of the step metadata (division, stage, prerequisites, trigger)
    // still comes from the static lib/steps.ts flow definition.
    supabase.from("step_definitions").select("code, name"),
  ])

  if (error || !data) return null

  const stepNameByCode = new Map(
    (stepDefRows ?? []).map((row) => [row.code, row.name as string])
  )

  const project = data as ProjectDetailRow

  const completionByCode = new Map<string, CompletionRow>()
  for (const completion of project.step_completions ?? []) {
    completionByCode.set(completion.step_code, completion)
  }

  const lastReminderByStep = new Map<string, string>()
  for (const log of project.reminder_log ?? []) {
    const existing = lastReminderByStep.get(log.step_code)
    if (!existing || log.sent_at > existing) {
      lastReminderByStep.set(log.step_code, log.sent_at)
    }
  }

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
  })

  const steps: StepTimelineItem[] = computedSteps.map((computed) => {
    const step = computed.definition
    const completion = completionByCode.get(step.code)
    const followUp = followUpByStep.get(step.code)

    return {
      code: step.code,
      order: step.order,
      name: stepNameByCode.get(step.code) ?? step.name,
      division: step.division,
      divisionLabel: getDivisionLabel(step.division),
      stage: step.stage,
      status: computed.status,
      prerequisites: step.prerequisites,
      completedAt: completion?.completed_at,
      completedByName: normalizeRelation(completion?.profile ?? null)?.name,
      note: completion?.note,
      outcome: completion?.outcome,
      lastReminderAt:
        computed.status === "active" ? lastReminderByStep.get(step.code) : undefined,
      followUpDate: followUp?.scheduled_date,
      followUpTime: followUp?.scheduled_time ?? "09:00:00",
      followUpNote: followUp?.note,
      checklist: step.checklist,
      dateInputs: step.dateInputs,
      hasOutcome: step.hasOutcome,
      canComplete:
        computed.status === "active" &&
        project.status === "active" &&
        canUserCompleteStep(userDivision, step.division),
    }
  })

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
