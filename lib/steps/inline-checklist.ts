import type { DateInputField } from "@/lib/steps"
import { requiresChecklist, type StepCompletionMode } from "@/lib/steps/completion-mode"

export function usesInlineChecklist(options: {
  completionMode?: StepCompletionMode
  checklist?: string[]
  hasOutcome?: boolean
  dateInputs?: DateInputField[]
}): boolean {
  const mode = options.completionMode ?? "normal"
  return (
    requiresChecklist(mode) &&
    Boolean(options.checklist?.length) &&
    !options.hasOutcome &&
    !(options.dateInputs && options.dateInputs.length > 0)
  )
}
