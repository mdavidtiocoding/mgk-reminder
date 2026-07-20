import type { SupabaseClient } from "@supabase/supabase-js"

import { getAppThresholds } from "@/lib/app-config"
import { daysSinceWib } from "@/lib/format"
import {
  computeProjectSteps,
  getActiveComputedSteps,
  type CompletionInfo,
} from "@/lib/projects/active-steps"
import { buildProjectSearchHaystack, matchesTokenSearch } from "@/lib/search/match"
import { type Division, getDivisionLabel } from "@/lib/steps"
import { loadRuntimeSteps } from "@/lib/steps/runtime-config"
import {
  getNextSubstep,
  getCompletedSubstepKeys,
  type SubstepCompletion,
  type SubstepDefinition,
} from "@/lib/steps/substeps"
import { loadSubstepCompletionsMap } from "@/lib/projects/substep-data"

type StepCompletionRow = {
  step_code: string
  completed_at: string
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
}

export type MyTask = {
  projectId: string
  projectName: string
  customerName: string | null
  stepCode: string
  stepName: string
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
  dateInputs?: import("@/lib/steps").DateInputField[]
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
  userDivision: Division | null | undefined
): boolean {
  if (!userDivision) return false
  if (userDivision === "admin") return true
  return userDivision === stepDivision
}

export async function getMyTasks(
  supabase: SupabaseClient,
  userDivision?: Division | null,
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
      step_completions(step_code, completed_at)
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
  const substepMap = await loadSubstepCompletionsMap(
    supabase,
    projectRows.map((project) => project.id)
  )

  const tasks: MyTask[] = []

  for (const project of projectRows) {
    const completions: CompletionInfo[] = (project.step_completions ?? []).map((c) => ({
      stepCode: c.step_code,
      completedAt: c.completed_at,
    }))

    const substepCompletions = substepMap.get(project.id) ?? []

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
      if (!isTaskForUser(step.division, userDivision)) continue

      const waitingDays = active.unlockedAt ? daysSince(active.unlockedAt) : 0
      const stepSubstepCompletions = substepCompletions.filter(
        (c) => c.stepCode === step.code
      )
      const completedKeys = getCompletedSubstepKeys(step.code, substepCompletions)
      const nextSubstep = getNextSubstep(step.substeps, completedKeys)

      const task: MyTask = {
        projectId: project.id,
        projectName: project.name,
        customerName: normalizeCustomer(project.customer)?.name ?? null,
        stepCode: step.code,
        stepName: step.name,
        divisionLabel: getDivisionLabel(step.division),
        waitingDays,
        isHogger: waitingDays > thresholds.hoggerDays,
        isWaitingWarning: waitingDays > thresholds.warningDays,
        canComplete: userDivision === "admin" || userDivision === step.division,
        substeps: step.substeps,
        substepCompletions: stepSubstepCompletions,
        nextSubstepLabel: nextSubstep?.label ?? null,
        hasOutcome: step.hasOutcome,
        checklist: step.checklist,
        dateInputs: step.dateInputs,
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
