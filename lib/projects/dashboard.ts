import type { SupabaseClient } from "@supabase/supabase-js"

import { getAppThresholds } from "@/lib/app-config"
import { daysSinceWib } from "@/lib/format"
import {
  hoursSince,
  isPastDelayThreshold,
  overdueHours,
  resolveDelayHours,
} from "@/lib/projects/delay"
import {
  computeProjectSteps,
  getActiveComputedSteps,
  type CompletionInfo,
} from "@/lib/projects/active-steps"
import { buildProjectSearchHaystack, matchesTokenSearch } from "@/lib/search/match"
import {
  type Division,
  getDivisionLabel,
  type ProjectStatus,
  STAGE_LABELS,
  TOTAL_STAGE_COUNT,
  TOTAL_STEP_COUNT,
} from "@/lib/steps"
import { loadRuntimeSteps } from "@/lib/steps/runtime-config"
import type { SubstepCompletion } from "@/lib/steps/substeps"
import { loadSubstepCompletionsMap } from "@/lib/projects/substep-data"

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
  waitingHours: number
  isHogger: boolean
  isWaitingWarning: boolean
  isDelayed: boolean
  overdueHours: number
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
  maxWaitingHours: number
  maxOverdueHours: number
  isHogger: boolean
  isWaitingWarning: boolean
  isDelayed: boolean
}

export type DashboardFilters = {
  status?: string
  stage?: string
  division?: string
  sort?: string
  q?: string
}

function daysSince(date: Date): number {
  return daysSinceWib(date)
}

function enrichProject(
  project: ProjectRow,
  hoggerDays: number,
  warningDays: number,
  delayHoursDefault: number,
  runtimeSteps: Awaited<ReturnType<typeof loadRuntimeSteps>>,
  substepCompletions: SubstepCompletion[] = []
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
  }, {
    steps: runtimeSteps,
    substepCompletions,
  })

  const doneCount = computedSteps.filter((s) => s.status === "done").length
  const activeComputed = getActiveComputedSteps(computedSteps)

  const activeSteps: DashboardActiveStep[] = activeComputed.map((s) => {
    const waitingDays = s.unlockedAt ? daysSince(s.unlockedAt) : 0
    const waitingHours = s.unlockedAt ? hoursSince(s.unlockedAt) : 0
    const delayHours = resolveDelayHours(
      s.definition.delayHours,
      delayHoursDefault
    )
    const isDelayed =
      project.status === "active" &&
      isPastDelayThreshold(s.unlockedAt, delayHours)
    return {
      code: s.definition.code,
      name: s.definition.name,
      division: s.definition.division,
      divisionLabel: getDivisionLabel(s.definition.division),
      waitingDays,
      waitingHours,
      isHogger: project.status === "active" && waitingDays > hoggerDays,
      isWaitingWarning: project.status === "active" && waitingDays > warningDays,
      isDelayed,
      overdueHours: isDelayed ? overdueHours(waitingHours, delayHours) : 0,
    }
  })

  const maxWaitingDays = activeSteps.reduce(
    (max, s) => Math.max(max, s.waitingDays),
    0
  )
  const maxWaitingHours = activeSteps.reduce(
    (max, s) => Math.max(max, s.waitingHours),
    0
  )
  const isDelayed = activeSteps.some((s) => s.isDelayed)

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
    maxWaitingHours,
    maxOverdueHours: activeSteps.reduce(
      (max, s) => Math.max(max, s.overdueHours),
      0
    ),
    isHogger: project.status === "active" && maxWaitingDays > hoggerDays,
    isWaitingWarning: project.status === "active" && maxWaitingDays > warningDays,
    isDelayed,
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

  if (filters.q?.trim()) {
    result = result.filter((project) =>
      matchesTokenSearch(
        buildProjectSearchHaystack([
          project.name,
          project.customerName,
          project.currentStageLabel,
          String(project.currentStage),
          project.status,
          ...project.activeSteps.flatMap((s) => [
            s.code,
            s.name,
            s.divisionLabel,
            s.division,
          ]),
        ]),
        filters.q!
      )
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
      step_completions(step_code, completed_at)
    `
      ),
    getAppThresholds(supabase),
    loadRuntimeSteps(supabase),
  ])

  if (error) {
    throw new Error(error.message)
  }

  const projectRows = (data ?? []) as ProjectRow[]
  const substepMap = await loadSubstepCompletionsMap(
    supabase,
    projectRows.map((project) => project.id)
  )

  const enriched = projectRows.map((project) =>
    enrichProject(
      project,
      thresholds.hoggerDays,
      thresholds.warningDays,
      thresholds.delayHours,
      runtimeSteps,
      substepMap.get(project.id) ?? []
    )
  )
  return sortProjects(filterProjects(enriched, filters), filters.sort)
}
