"use client"

import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState, useTransition } from "react"
import { Undo2 } from "lucide-react"

import { completeSubstep, undoSubstep } from "@/app/actions/complete-substep"
import { StepChecklistFields } from "@/components/project/step-checklist-fields"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatDateKey, formatDateTime } from "@/lib/format"
import type { SubstepDefinition, SubstepCompletion } from "@/lib/steps/substeps"
import { isChecklistItemComplete } from "@/lib/steps/checklist-response"
import {
  canCompleteSubstepNow,
  canUndoSubstepNow,
  getCompletedSubstepKeys,
  getSubstepChecklist,
  getSubstepKind,
} from "@/lib/steps/substeps"

type SubstepActionsProps = {
  projectId: string
  stepCode: string
  substeps: SubstepDefinition[]
  completions: SubstepCompletion[]
  canEdit: boolean
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
  const [pendingSubstep, setPendingSubstep] = useState<SubstepDefinition | null>(null)
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set())
  const [checklistItemNotes, setChecklistItemNotes] = useState<Record<string, string>>({})
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({})

  const completionSignature = completions
    .filter((c) => c.stepCode === stepCode)
    .map((c) => `${c.substepKey}:${c.completedAt}`)
    .join("|")

  useEffect(() => {
    setOptimistic({})
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

  function closeConfirm() {
    if (isPending) return
    setPendingSubstep(null)
  }

  function markDone(substep: SubstepDefinition, checklistOptions?: {
    checkedItems?: string[]
    checklistItemNotes?: Record<string, string>
  }) {
    setError(null)
    setOptimistic((prev) => ({ ...prev, [substep.key]: true }))
    startTransition(async () => {
      const result = await completeSubstep(projectId, stepCode, substep.key, checklistOptions)
      if (!result.success) {
        setOptimistic((prev) => ({ ...prev, [substep.key]: false }))
        setError(result.error)
        return
      }
      setPendingSubstep(null)
      router.refresh()
    })
  }

  function onSubstepClick(substep: SubstepDefinition) {
    const checklist = getSubstepChecklist(substep)
    if (checklist.length > 0) {
      setError(null)
      setCheckedItems(new Set())
      setChecklistItemNotes({})
      setPendingSubstep(substep)
      return
    }
    markDone(substep)
  }

  const pendingChecklist = pendingSubstep
    ? getSubstepChecklist(pendingSubstep)
    : []
  const pendingChecklistComplete =
    pendingChecklist.length === 0 ||
    pendingChecklist.every((item) =>
      isChecklistItemComplete({
        item,
        checked: checkedItems.has(item),
        note: checklistItemNotes[item],
      })
    )

  function toggleChecklistItem(item: string) {
    setCheckedItems((prev) => {
      const next = new Set(prev)
      if (next.has(item)) next.delete(item)
      else {
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

  function handleConfirm() {
    if (!pendingSubstep || !pendingChecklistComplete) return
    markDone(pendingSubstep, {
      checkedItems: Array.from(checkedItems),
      checklistItemNotes,
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
    <>
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1.5">
          {substeps.map((substep) => {
            const done = completedKeys.has(substep.key)
            const completion = stepCompletions.find((c) => c.substepKey === substep.key)
            const kind = getSubstepKind(substep)
            const checklist = getSubstepChecklist(substep)
            const actionable =
              canEdit && canCompleteSubstepNow(substep, substeps, completedKeys)
            const canUndo =
              canEdit && canUndoSubstepNow(substep, substeps, completedKeys)

            return (
              <div
                key={substep.key}
                className="flex flex-col gap-1 rounded-md border px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {kind === "reminder" && !done && (
                    <Badge variant="outline" className="text-[10px]">
                      Reminder
                    </Badge>
                  )}
                  {!done && checklist.length > 0 && (
                    <Badge variant="outline" className="text-[10px]">
                      {checklist.length} checklist
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
                    <Button
                      type="button"
                      size="sm"
                      variant={kind === "reminder" ? "outline" : "default"}
                      disabled={isPending}
                      onClick={() => onSubstepClick(substep)}
                    >
                      {substep.label}
                    </Button>
                  ) : (
                    <span className="text-sm text-muted-foreground">{substep.label}</span>
                  )}
                </div>
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
                      <p className="whitespace-pre-wrap italic">
                        {completion.note}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {error && !pendingSubstep && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        {canEdit && completedKeys.size > 0 && (
          <p className="text-[11px] text-muted-foreground">
            Salah klik? tekan Undo. Kalau sudah lanjut ke sub-step wajib berikutnya, undo yang itu dulu.
          </p>
        )}
      </div>

      <Dialog open={!!pendingSubstep} onOpenChange={(open) => !open && closeConfirm()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{pendingSubstep?.label}</DialogTitle>
            <DialogDescription>
              Checklist sub-step ini harus selesai dulu. Waktu dicatat otomatis saat Simpan.
              {pendingSubstep && getSubstepKind(pendingSubstep) === "reminder" && (
                <span className="mt-1 block">
                  Sub-step reminder tidak memblokir unlock step berikutnya.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            {pendingChecklist.length > 0 && (
              <StepChecklistFields
                checklist={pendingChecklist}
                checkedItems={checkedItems}
                checklistItemNotes={checklistItemNotes}
                onToggleItem={toggleChecklistItem}
                onItemNoteChange={(item, value) =>
                  setChecklistItemNotes((prev) => ({ ...prev, [item]: value }))
                }
                compact
              />
            )}
          </div>

          {error && pendingSubstep && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeConfirm} disabled={isPending}>
              Batal
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={isPending || !pendingChecklistComplete}
            >
              {isPending ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
