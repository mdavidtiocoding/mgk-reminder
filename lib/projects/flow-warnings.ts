import type { StepStatus } from "@/lib/projects/detail"

export function stepHasRecordedProgress(
  status: StepStatus,
  substepCompletionCount: number
): boolean {
  return status === "done" || status === "active" || substepCompletionCount > 0
}

/** Step dengan order lebih kecil yang belum selesai — indikasi loncat / isi duluan. */
export function getPriorIncompleteStepCodes(
  stepOrder: number,
  steps: { code: string; order: number; status: StepStatus }[]
): string[] {
  return steps
    .filter((s) => s.order < stepOrder && s.status !== "done")
    .map((s) => s.code)
}

export function getMissingPrerequisiteCodes(
  prerequisites: string[],
  stepsByCode: Map<string, { status: StepStatus }>
): string[] {
  return prerequisites.filter((code) => {
    const prereq = stepsByCode.get(code)
    return !prereq || prereq.status !== "done"
  })
}

export function buildStepFlowWarnings(
  step: {
    code: string
    order: number
    status: StepStatus
    prerequisites: string[]
    substepCompletionCount: number
  },
  allSteps: { code: string; order: number; status: StepStatus; prerequisites: string[] }[]
): string[] {
  if (!stepHasRecordedProgress(step.status, step.substepCompletionCount)) {
    return []
  }

  const byCode = new Map(allSteps.map((s) => [s.code, s]))
  const prior = getPriorIncompleteStepCodes(step.order, allSteps)
  const missingPrereqs = getMissingPrerequisiteCodes(step.prerequisites, byCode)

  return [...new Set([...missingPrereqs, ...prior])]
}
