import {
  areRequiredSubstepsComplete,
  getCompletedSubstepKeys,
  type SubstepCompletion,
} from "@/lib/steps/substeps"
import type { RuntimeStep } from "@/lib/steps/runtime-config"
import {
  STEPS,
  type DateField,
  type StepDefinition,
} from "@/lib/steps"

export type CompletionInfo = {
  stepCode: string
  completedAt: string
  completedByName?: string | null
  note?: string | null
  outcome?: string | null
}

export type ProjectDates = {
  createdAt: string
  ex_work_date?: string | null
  etd_date?: string | null
  eta_date?: string | null
  mos_date?: string | null
}

export type StepComputedStatus = "done" | "active" | "locked"

export type ComputedStep = {
  definition: RuntimeStep
  status: StepComputedStatus
  completion?: CompletionInfo
  /** When this step's prerequisites were all satisfied (used for waiting/hogger). */
  unlockedAt: Date | null
  /** Earliest moment a reminder is eligible to fire for this step (trigger-type aware). */
  triggerAt: Date | null
}

export type ComputeProjectStepsOptions = {
  steps?: RuntimeStep[]
  substepCompletions?: SubstepCompletion[]
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

function parseDateOnly(value?: string | null): Date | null {
  if (!value) return null
  const [y, m, d] = value.split("-").map(Number)
  if (!y || !m || !d) return null
  return new Date(Date.UTC(y, m - 1, d))
}

function maxDate(dates: Date[]): Date | null {
  if (dates.length === 0) return null
  return new Date(Math.max(...dates.map((d) => d.getTime())))
}

function getProjectDateField(project: ProjectDates, field: DateField): string | null | undefined {
  return project[field]
}

function computeUnlockedAt(
  step: StepDefinition,
  completionByCode: Map<string, CompletionInfo>,
  project: ProjectDates
): Date {
  if (step.prerequisites.length === 0) {
    return new Date(project.createdAt)
  }
  const prereqDates = step.prerequisites
    .map((code) => completionByCode.get(code)?.completedAt)
    .filter((v): v is string => !!v)
    .map((v) => new Date(v))
  return maxDate(prereqDates) ?? new Date(project.createdAt)
}

export function computeTriggerDate(
  step: StepDefinition,
  unlockedAt: Date | null,
  completionByCode: Map<string, CompletionInfo>,
  project: ProjectDates
): Date | null {
  const trigger = step.trigger

  switch (trigger.type) {
    case "immediate":
    case "interval":
      return unlockedAt

    case "after_step": {
      const ref = completionByCode.get(trigger.stepCode)
      if (!ref) return unlockedAt
      return addDays(new Date(ref.completedAt), trigger.offsetDays)
    }

    case "before_date": {
      const base = parseDateOnly(getProjectDateField(project, trigger.dateField))
      if (!base) return null
      return addDays(base, -trigger.offsetDays)
    }

    case "after_date": {
      const base = parseDateOnly(getProjectDateField(project, trigger.dateField))
      if (!base) return null
      return addDays(base, trigger.offsetDays)
    }

    default:
      return unlockedAt
  }
}

/** Repeat cadence declared by the step's own trigger definition (before any admin override). */
export function getDefaultRepeatDays(step: StepDefinition): number | undefined {
  const trigger = step.trigger
  if (trigger.type === "after_step" || trigger.type === "before_date" || trigger.type === "after_date") {
    return trigger.repeatDays
  }
  if (trigger.type === "interval") {
    return trigger.intervalDays
  }
  return undefined
}

export function buildDoneCodes(
  completions: CompletionInfo[],
  substepCompletions: SubstepCompletion[],
  steps: RuntimeStep[]
): Set<string> {
  const completionByCode = new Map(completions.map((c) => [c.stepCode, c]))
  const done = new Set<string>()

  for (const step of steps) {
    if (step.substeps.length > 0) {
      const completedKeys = getCompletedSubstepKeys(step.code, substepCompletions)
      if (areRequiredSubstepsComplete(step.substeps, completedKeys)) {
        done.add(step.code)
      }
      continue
    }

    if (completionByCode.has(step.code)) {
      done.add(step.code)
    }
  }

  return done
}

export function isStepActiveForFlow(
  step: RuntimeStep,
  doneCodes: Set<string>
): boolean {
  if (doneCodes.has(step.code)) return false
  return step.prerequisites.every((code) => doneCodes.has(code))
}

export function computeProjectSteps(
  completions: CompletionInfo[],
  project: ProjectDates,
  options: ComputeProjectStepsOptions = {}
): ComputedStep[] {
  const steps = options.steps ?? (STEPS as RuntimeStep[])
  const substepCompletions = options.substepCompletions ?? []
  const completionByCode = new Map(completions.map((c) => [c.stepCode, c]))
  const doneCodes = buildDoneCodes(completions, substepCompletions, steps)

  return steps.map((step) => {
    const completion = completionByCode.get(step.code)
    const completedSubstepKeys = getCompletedSubstepKeys(step.code, substepCompletions)

    if (doneCodes.has(step.code)) {
      const completedAt =
        completion?.completedAt ??
        substepCompletions
          .filter((c) => c.stepCode === step.code)
          .map((c) => c.completedAt)
          .sort()
          .at(-1)

      return {
        definition: step,
        status: "done" as const,
        completion: completedAt
          ? {
              stepCode: step.code,
              completedAt,
              completedByName: completion?.completedByName,
              note: completion?.note,
              outcome: completion?.outcome,
            }
          : completion,
        unlockedAt: null,
        triggerAt: null,
      }
    }

    const active = isStepActiveForFlow(step, doneCodes)
    if (!active) {
      return {
        definition: step,
        status: "locked" as const,
        unlockedAt: null,
        triggerAt: null,
      }
    }

    const unlockedAt = computeUnlockedAt(step, completionByCode, project)
    const triggerAt = computeTriggerDate(step, unlockedAt, completionByCode, project)

    return {
      definition: step,
      status: "active" as const,
      completion:
        completedSubstepKeys.size > 0
          ? {
              stepCode: step.code,
              completedAt:
                substepCompletions
                  .filter((c) => c.stepCode === step.code)
                  .map((c) => c.completedAt)
                  .sort()
                  .at(-1) ?? unlockedAt.toISOString(),
            }
          : undefined,
      unlockedAt,
      triggerAt,
    }
  })
}

export function getActiveComputedSteps(steps: ComputedStep[]): ComputedStep[] {
  return steps.filter((step) => step.status === "active")
}

export function isProjectFullyComplete(steps: ComputedStep[]): boolean {
  return steps.every((step) => step.status === "done")
}

export function countDone(steps: ComputedStep[]): number {
  return steps.filter((step) => step.status === "done").length
}
