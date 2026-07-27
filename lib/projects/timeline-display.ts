import type { StepTimelineItem } from "@/lib/projects/detail"

export type TimelineSingleItem = {
  kind: "single"
  step: StepTimelineItem
}

export type TimelineConvergenceItem = {
  kind: "convergence"
  target: StepTimelineItem
  prerequisites: StepTimelineItem[]
}

export type TimelineDisplayItem = TimelineSingleItem | TimelineConvergenceItem

/** Prerequisites in the same stage that are not done yet. */
export function pendingPrerequisitesInStage(
  step: StepTimelineItem,
  byCode: Map<string, StepTimelineItem>
): StepTimelineItem[] {
  return step.prerequisites
    .map((code) => byCode.get(code))
    .filter((s): s is StepTimelineItem => !!s && s.status !== "done")
}

/**
 * Order steps within a stage so prerequisites appear before dependents.
 */
export function sortStepsForTimelineDisplay(
  steps: StepTimelineItem[]
): StepTimelineItem[] {
  const codesInStage = new Set(steps.map((s) => s.code))
  const remaining = [...steps]
  const sorted: StepTimelineItem[] = []
  const placed = new Set<string>()

  while (remaining.length > 0) {
    const nextIndex = remaining.findIndex((step) =>
      step.prerequisites.every((code) => !codesInStage.has(code) || placed.has(code))
    )

    if (nextIndex === -1) {
      remaining.sort((a, b) => a.order - b.order)
      sorted.push(...remaining)
      break
    }

    const [step] = remaining.splice(nextIndex, 1)
    sorted.push(step)
    placed.add(step.code)
  }

  return sorted
}

/**
 * Group locked multi-prerequisite steps with their in-stage prerequisites
 * (A + B attached → C).
 */
export function buildTimelineDisplayItems(
  steps: StepTimelineItem[]
): TimelineDisplayItem[] {
  const sorted = sortStepsForTimelineDisplay(steps)
  const byCode = new Map(sorted.map((step) => [step.code, step]))
  const consumed = new Set<string>()
  const items: TimelineDisplayItem[] = []

  for (const step of sorted) {
    if (consumed.has(step.code)) continue

    const prereqsInStage = step.prerequisites
      .filter((code) => byCode.has(code))
      .map((code) => byCode.get(code)!)

    const shouldConverge =
      step.status === "locked" &&
      prereqsInStage.length >= 2 &&
      prereqsInStage.every((p) => p.status === "done" || p.status === "active")

    if (shouldConverge) {
      const prerequisites = [...prereqsInStage].sort((a, b) => a.order - b.order)
      for (const prereq of prerequisites) {
        consumed.add(prereq.code)
      }
      consumed.add(step.code)
      items.push({ kind: "convergence", target: step, prerequisites })
      continue
    }

    items.push({ kind: "single", step })
  }

  return items
}
