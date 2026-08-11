"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { completeStep } from "@/app/actions/complete-step"
import { StepChecklistFields } from "@/components/project/step-checklist-fields"
import { Button } from "@/components/ui/button"
import { isChecklistItemComplete } from "@/lib/steps/checklist-response"
import {
  allowsChecklistItemNotes,
  type StepCompletionMode,
} from "@/lib/steps/completion-mode"

type StepChecklistCompletionProps = {
  projectId: string
  stepCode: string
  checklist: string[]
  completionMode?: StepCompletionMode
  compact?: boolean
}

export function StepChecklistCompletion({
  projectId,
  stepCode,
  checklist,
  completionMode = "checklist",
  compact = false,
}: StepChecklistCompletionProps) {
  const router = useRouter()
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set())
  const [checklistItemNotes, setChecklistItemNotes] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const itemNotesAllowed = allowsChecklistItemNotes(completionMode)

  function toggleChecklistItem(item: string) {
    setCheckedItems((prev) => {
      const next = new Set(prev)
      if (next.has(item)) {
        next.delete(item)
      } else {
        next.add(item)
        setChecklistItemNotes((notes) => {
          if (!notes[item]) return notes
          const { [item]: _removed, ...rest } = notes
          return rest
        })
      }
      return next
    })
  }

  const checklistComplete = checklist.every((item) =>
    isChecklistItemComplete(
      {
        item,
        checked: checkedItems.has(item),
        note: checklistItemNotes[item],
      },
      { allowItemNotes: itemNotesAllowed }
    )
  )
  const canSubmit = checklistComplete

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result = await completeStep(projectId, stepCode, {
        checkedItems: Array.from(checkedItems),
        checklistItemNotes,
      })
      if (result.success) {
        router.refresh()
        return
      }
      setError(result.error)
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <StepChecklistFields
        checklist={checklist}
        checkedItems={checkedItems}
        checklistItemNotes={checklistItemNotes}
        onToggleItem={toggleChecklistItem}
        onItemNoteChange={(item, value) =>
          setChecklistItemNotes((prev) => ({ ...prev, [item]: value }))
        }
        compact={compact}
        allowItemNotes={itemNotesAllowed}
      />

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div>
        <Button size="sm" onClick={handleSubmit} disabled={isPending || !canSubmit}>
          {isPending ? "Menyimpan..." : "Tandai Selesai"}
        </Button>
      </div>
    </div>
  )
}
