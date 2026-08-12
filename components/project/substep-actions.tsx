"use client"

import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState, useTransition } from "react"
import { Undo2 } from "lucide-react"

import { completeSubstep, undoSubstep } from "@/app/actions/complete-substep"
import { StepChecklistFields } from "@/components/project/step-checklist-fields"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDateKey, formatDateTime } from "@/lib/format"
import type { SubstepDefinition, SubstepCompletion } from "@/lib/steps/substeps"
import { isChecklistItemComplete } from "@/lib/steps/checklist-response"
import {
  canCompleteSubstepNow,
  canUndoSubstepNow,
  getCompletedSubstepKeys,
  getSubstepChecklist,
  getSubstepKind,
  substepAllowsItemNotes,
} from "@/lib/steps/substeps"

type SubstepActionsProps = {
  projectId: string
  stepCode: string
  substeps: SubstepDefinition[]
  completions: SubstepCompletion[]
  canEdit: boolean
}

type ChecklistDraft = {
  checked: Set<string>
  notes: Record<string, string>
}

const EMPTY_DRAFT: ChecklistDraft = { checked: new Set(), notes: {} }

function isChecklistComplete(
  checklist: string[],
  draft: ChecklistDraft,
  allowItemNotes: boolean
): boolean {
  if (checklist.length === 0) return true
  return checklist.every((item) =>
    isChecklistItemComplete(
      {
        item,
        checked: draft.checked.has(item),
        note: draft.notes[item],
      },
      { allowItemNotes }
    )
  )
}

export function SubstepActions({
  projectId,
  stepCode,
  substeps,
  completions,
  canEdit,
}: SubstepActionsProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [checklistDrafts, setChecklistDrafts] = useState<Record<string, ChecklistDraft>>({})
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({})

  const completionSignature = completions
    .filter((c) => c.stepCode === stepCode)
    .map((c) => `${c.substepKey}:${c.completedAt}`)
    .join("|")

  useEffect(() => {
    setOptimistic({})
    setChecklistDrafts({})
  }, [completionSignature])

  const completedKeys = useMemo(() => {
    const keys = getCompletedSubstepKeys(stepCode, completions)
    for (const [key, done] of Object.entries(optimistic)) {
      if (done) keys.add(key)
      else keys.delete(key)
    }
    return keys
  }, [completions, optimistic, stepCode])

  if (substeps.length === 0) return null

  const stepCompletions = completions.filter((c) => c.stepCode === stepCode)

  function getDraft(substepKey: string): ChecklistDraft {
    return checklistDrafts[substepKey] ?? EMPTY_DRAFT
  }

  function updateDraft(
    substepKey: string,
    updater: (draft: ChecklistDraft) => ChecklistDraft
  ) {
    setChecklistDrafts((prev) => ({
      ...prev,
      [substepKey]: updater(prev[substepKey] ?? EMPTY_DRAFT),
    }))
  }

  function toggleChecklistItem(substepKey: string, item: string) {
    updateDraft(substepKey, (draft) => {
      const checked = new Set(draft.checked)
      const notes = { ...draft.notes }
      if (checked.has(item)) {
        checked.delete(item)
      } else {
        checked.add(item)
        delete notes[item]
      }
      return { checked, notes }
    })
  }

  function markDone(
    substep: SubstepDefinition,
    checklistOptions?: {
      checkedItems?: string[]
      checklistItemNotes?: Record<string, string>
    }
  ) {
    setError(null)
    setOptimistic((prev) => ({ ...prev, [substep.key]: true }))
    startTransition(async () => {
      const result = await completeSubstep(projectId, stepCode, substep.key, checklistOptions)
      if (!result.success) {
        setOptimistic((prev) => ({ ...prev, [substep.key]: false }))
        setError(result.error)
        return
      }
      setChecklistDrafts((prev) => {
        const next = { ...prev }
        delete next[substep.key]
        return next
      })
      router.refresh()
    })
  }

  function handleUndo(substepKey: string) {
    setError(null)
    setOptimistic((prev) => ({ ...prev, [substepKey]: false }))
    startTransition(async () => {
      const result = await undoSubstep(projectId, stepCode, substepKey)
      if (!result.success) {
        setOptimistic((prev) => ({ ...prev, [substepKey]: true }))
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1.5">
        {substeps.map((substep) => {
          const done = completedKeys.has(substep.key)
          const completion = stepCompletions.find((c) => c.substepKey === substep.key)
          const kind = getSubstepKind(substep)
          const checklist = getSubstepChecklist(substep)
          const hasChecklist = checklist.length > 0
          const allowItemNotes = substepAllowsItemNotes(substep)
          const actionable =
            canEdit && canCompleteSubstepNow(substep, substeps, completedKeys)
          const canUndo =
            canEdit && canUndoSubstepNow(substep, substeps, completedKeys)
          const draft = getDraft(substep.key)
          const checklistComplete = isChecklistComplete(
            checklist,
            draft,
            allowItemNotes
          )

          return (
            <div
              key={substep.key}
              className="flex flex-col gap-2 rounded-md border px-3 py-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                {kind === "reminder" && !done && (
                  <Badge variant="outline" className="text-[10px]">
                    Reminder
                  </Badge>
                )}
                {done ? (
                  <>
                    <Badge variant="secondary">{substep.label}</Badge>
                    {completion?.completedByName && (
                      <span className="text-xs text-muted-foreground">
                        oleh {completion.completedByName}
                      </span>
                    )}
                    {canEdit && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="ml-auto h-7 px-2 text-xs"
                        disabled={isPending || !canUndo}
                        title={
                          canUndo
                            ? "Batalkan kalau salah klik"
                            : "Undo sub-step wajib berikutnya dulu"
                        }
                        onClick={() => handleUndo(substep.key)}
                      >
                        <Undo2 className="mr-1 size-3" />
                        Undo
                      </Button>
                    )}
                  </>
                ) : actionable ? (
                  hasChecklist ? (
                    <span className="text-sm font-medium">{substep.label}</span>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant={kind === "reminder" ? "outline" : "default"}
                      disabled={isPending}
                      onClick={() => markDone(substep)}
                    >
                      {substep.label}
                    </Button>
                  )
                ) : (
                  <span className="text-sm text-muted-foreground">{substep.label}</span>
                )}
              </div>

              {!done && actionable && hasChecklist && (
                <>
                  <StepChecklistFields
                    checklist={checklist}
                    checkedItems={draft.checked}
                    checklistItemNotes={draft.notes}
                    onToggleItem={(item) => toggleChecklistItem(substep.key, item)}
                    onItemNoteChange={(item, value) =>
                      updateDraft(substep.key, (d) => ({
                        checked: d.checked,
                        notes: { ...d.notes, [item]: value },
                      }))
                    }
                    allowItemNotes={allowItemNotes}
                    compact
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant={kind === "reminder" ? "outline" : "default"}
                    className="w-fit"
                    disabled={isPending || !checklistComplete}
                    onClick={() =>
                      markDone(substep, {
                        checkedItems: Array.from(draft.checked),
                        checklistItemNotes: draft.notes,
                      })
                    }
                  >
                    {isPending ? "Menyimpan…" : substep.label}
                  </Button>
                </>
              )}

              {done && (
                <div className="text-xs text-muted-foreground">
                  <p>
                    Dicatat:{" "}
                    {completion
                      ? formatDateTime(completion.completedAt)
                      : "baru saja"}
                  </p>
                  {completion?.eventDate && (
                    <p>Tanggal: {formatDateKey(completion.eventDate)}</p>
                  )}
                  {completion?.note && (
                    <p className="whitespace-pre-wrap italic">{completion.note}</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {canEdit && completedKeys.size > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Salah klik? tekan Undo. Kalau sudah lanjut ke sub-step wajib berikutnya,
          undo yang itu dulu.
        </p>
      )}
    </div>
  )
}
