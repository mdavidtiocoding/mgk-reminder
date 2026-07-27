"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { completeStep } from "@/app/actions/complete-step"
import { StepChecklistFields } from "@/components/project/step-checklist-fields"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { todayDateKeyWib } from "@/lib/format"
import type { DateInputField } from "@/lib/steps"
import { isChecklistItemComplete } from "@/lib/steps/checklist-response"
import {
  COMPLETION_MODE_LABELS,
  requiresChecklist,
  requiresKeterangan,
  type StepCompletionMode,
} from "@/lib/steps/completion-mode"

type MarkDoneDialogProps = {
  projectId: string
  stepCode: string
  stepName: string
  completionMode?: StepCompletionMode
  checklist?: string[]
  dateInputs?: DateInputField[]
  hasOutcome?: boolean
}

export function MarkDoneDialog({
  projectId,
  stepCode,
  stepName,
  completionMode = "normal",
  checklist,
  dateInputs,
  hasOutcome,
}: MarkDoneDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState("")
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set())
  const [checklistItemNotes, setChecklistItemNotes] = useState<Record<string, string>>({})
  const [dateValues, setDateValues] = useState<Record<string, string>>({})
  const [outcome, setOutcome] = useState<"ok" | "reschedule" | "">("")
  const [rescheduleDate, setRescheduleDate] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const showChecklist =
    requiresChecklist(completionMode) && checklist && checklist.length > 0
  const noteRequired = requiresKeterangan(completionMode)

  function resetState() {
    setNote("")
    setCheckedItems(new Set())
    setChecklistItemNotes({})
    setDateValues({})
    setOutcome("")
    setRescheduleDate("")
    setError(null)
  }

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

  const checklistComplete =
    !showChecklist ||
    checklist!.every((item) =>
      isChecklistItemComplete({
        item,
        checked: checkedItems.has(item),
        note: checklistItemNotes[item],
      })
    )
  const dateInputsComplete =
    !dateInputs ||
    dateInputs.length === 0 ||
    dateInputs.every((input) => !!dateValues[input.field])
  const outcomeComplete =
    !hasOutcome ||
    outcome === "ok" ||
    (outcome === "reschedule" && !!rescheduleDate)
  const noteComplete = !noteRequired || note.trim().length > 0

  const canSubmit =
    checklistComplete && dateInputsComplete && outcomeComplete && noteComplete

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result = await completeStep(projectId, stepCode, {
        note,
        checkedItems: showChecklist ? Array.from(checkedItems) : undefined,
        checklistItemNotes: showChecklist ? checklistItemNotes : undefined,
        dateInputs: dateInputs?.length ? dateValues : undefined,
        outcome: hasOutcome ? outcome || undefined : undefined,
        rescheduleDate: outcome === "reschedule" ? rescheduleDate : undefined,
      })
      if (result.success) {
        setOpen(false)
        resetState()
        router.refresh()
        return
      }
      setError(result.error)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) resetState()
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">Tandai Selesai</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tandai step ini selesai?</DialogTitle>
          <DialogDescription>
            {stepCode}: {stepName}
            {completionMode !== "normal" && (
              <span className="mt-1 block text-xs">
                Mode: {COMPLETION_MODE_LABELS[completionMode]}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {hasOutcome && (
            <div className="flex flex-col gap-2">
              <Label>Hasil survey</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={outcome === "ok" ? "default" : "outline"}
                  onClick={() => setOutcome("ok")}
                >
                  Survey OK
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={outcome === "reschedule" ? "default" : "outline"}
                  onClick={() => setOutcome("reschedule")}
                >
                  Perlu Reschedule
                </Button>
              </div>
              {outcome === "reschedule" && (
                <div className="mt-1 flex flex-col gap-1.5">
                  <Label htmlFor="reschedule-date" className="text-xs">
                    Tanggal Ex Work baru
                  </Label>
                  <Input
                    id="reschedule-date"
                    type="date"
                    min={todayDateKeyWib()}
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          {showChecklist && (
            <StepChecklistFields
              checklist={checklist!}
              checkedItems={checkedItems}
              checklistItemNotes={checklistItemNotes}
              onToggleItem={toggleChecklistItem}
              onItemNoteChange={(item, value) =>
                setChecklistItemNotes((prev) => ({ ...prev, [item]: value }))
              }
            />
          )}

          {dateInputs && dateInputs.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {dateInputs.map((input) => (
                <div key={input.field} className="flex flex-col gap-1.5">
                  <Label htmlFor={`date-${input.field}`} className="text-xs">
                    {input.label}
                  </Label>
                  <Input
                    id={`date-${input.field}`}
                    type="date"
                    value={dateValues[input.field] ?? ""}
                    onChange={(e) =>
                      setDateValues((prev) => ({ ...prev, [input.field]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
          )}

          {(noteRequired || !showChecklist) && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="note">
                {noteRequired ? "Keterangan (wajib)" : "Catatan (opsional)"}
              </Label>
              <Textarea
                id="note"
                placeholder={
                  noteRequired
                    ? "Isi keterangan sebelum menyelesaikan step…"
                    : "Tambahkan catatan jika perlu…"
                }
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !canSubmit}>
            {isPending ? "Menyimpan..." : "Konfirmasi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
