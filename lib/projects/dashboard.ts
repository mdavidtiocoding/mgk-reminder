import type { SupabaseClient } from "@supabase/supabase-js"

import { getAppThresholds } from "@/lib/app-config"
import { daysSinceWib } from "@/lib/format"
import {
  computeProjectSteps,
  getActiveComputedSteps,
  type CompletionInfo,
} from "@/lib/projects/active-steps"
import {
  type Division,
  getDivisionLabel,
  type ProjectStatus,
  STAGE_LABELS,
  TOTAL_STAGE_COUNT,
  TOTAL_STEP_COUNT,
} from "@/lib/steps"

type StepCompletionRow = {
  step_code: string
  completed_at: string
}

type ProjectRow = {
  id: string
  name: string
  status: ProjectStatus
  created_at: string
  ex_work_date: string | null
  etd_date: string | null
  eta_date: string | null
  mos_date: string | null
  customer: { name: string } | { name: string }[] | null
  step_completions: StepCompletionRow[]
}

function normalizeCustomer(
  customer: ProjectRow["customer"]
): { name: string } | null {
  if (!customer) return null
  if (Array.isArray(customer)) return customer[0] ?? null
  return customer
}

export type DashboardActiveStep = {
  code: string
  name: string
  division: Division
  divisionLabel: string
  waitingDays: number
  isHogger: boolean
  isWaitingWarning: boolean
}

export type DashboardProject = {
  id: string
  name: string
  status: ProjectStatus
  createdAt: string
  customerName: string | null
  activeSteps: DashboardActiveStep[]
  doneCount: number
  totalCount: number
  stepProgress: number
  currentStage: number
  currentStageLabel: string
  stageProgress: number
  maxWaitingDays: number
  isHogger: boolean
  isWaitingWarning: boolean
}

export type DashboardFilters = {
  status?: string
  stage?: string
  division?: string
  sort?: string
}

function daysSince(date: Date): number {
  return daysSinceWib(date)
}

function enrichProject(
  project: ProjectRow,
  hoggerDays: number,
  warningDays: number
): DashboardProject {
  const completions: CompletionInfo[] = (project.step_completions ?? []).map((c) => ({
    stepCode: c.step_code,
    completedAt: c.completed_at,
  }))

  const computedSteps = computeProjectSteps(completions, {
    createdAt: project.created_at,
    ex_work_date: project.ex_work_date,
    etd_date: project.etd_date,
    eta_date: project.eta_date,
    mos_date: project.mos_date,
  })

  const doneCount = computedSteps.filter((s) => s.status === "done").length
  const activeComputed = getActiveComputedSteps(computedSteps)

  const activeSteps: DashboardActiveStep[] = activeComputed.map((s) => {
    const waitingDays = s.unlockedAt ? daysSince(s.unlockedAt) : 0
    return {
      code: s.definition.code,
      name: s.definition.name,
      division: s.definition.division,
      divisionLabel: getDivisionLabel(s.definition.division),
      waitingDays,
      isHogger: project.status === "active" && waitingDays > hoggerDays,
      isWaitingWarning: project.status === "active" && waitingDays > warningDays,
    }
  })

  const maxWaitingDays = activeSteps.reduce(
    (max, s) => Math.max(max, s.waitingDays),
    0
  )

  const activeStages = activeSteps.map((s) => {
    const def = computedSteps.find((c) => c.definition.code === s.code)
    return def?.definition.stage ?? 1
  })

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
    customerName: normalizeCustomer(project.customer)?.name ?? null,
    activeSteps,
    doneCount,
    totalCount: TOTAL_STEP_COUNT,
    stepProgress: Math.round((doneCount / TOTAL_STEP_COUNT) * 100),
    currentStage,
    currentStageLabel: STAGE_LABELS[currentStage] ?? "",
    stageProgress: Math.round((currentStage / TOTAL_STAGE_COUNT) * 100),
    maxWaitingDays,
    isHogger: project.status === "active" && maxWaitingDays > hoggerDays,
    isWaitingWarning: project.status === "active" && maxWaitingDays > warningDays,
  }
}

function filterProjects(
  projects: DashboardProject[],
  filters: DashboardFilters
): DashboardProject[] {
  let result = projects

  const status = filters.status ?? "active"
  if (status !== "all") {
    result = result.filter((project) => project.status === status)
  }

  if (filters.stage && filters.stage !== "all") {
    const stage = Number(filters.stage)
    result = result.filter((project) => project.currentStage === stage)
  }

  if (filters.division && filters.division !== "all") {
    result = result.filter((project) =>
      project.activeSteps.some((s) => s.division === filters.division)
    )
  }

  return result
}

function sortProjects(
  projects: DashboardProject[],
  sort: string | undefined
): DashboardProject[] {
  const sorted = [...projects]

  switch (sort) {
    case "stuck":
      return sorted.sort((a, b) => b.maxWaitingDays - a.maxWaitingDays)
    case "stage":
      return sorted.sort((a, b) => a.currentStage - b.currentStage)
    case "newest":
    default:
      return sorted.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
  }
}

export async function getDashboardProjects(
  supabase: SupabaseClient,
  filters: DashboardFilters = {}
): Promise<DashboardProject[]> {
  const [{ data, error }, thresholds] = await Promise.all([
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
      step_completions(step_code, completed_at)
    `
      ),
    getAppThresholds(supabase),
  ])

  if (error) {
    throw new Error(error.message)
  }

  const enriched = ((data ?? []) as ProjectRow[]).map((project) =>
    enrichProject(project, thresholds.hoggerDays, thresholds.warningDays)
  )
  return sortProjects(filterProjects(enriched, filters), filters.sort)
}
