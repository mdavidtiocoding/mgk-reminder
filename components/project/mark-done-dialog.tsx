"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { completeStep } from "@/app/actions/complete-step"
import { ProjectCompletedDialog } from "@/components/project/project-completed-dialog"
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
import { DATE_FIELD_LABELS, type DateField, type DateInputField } from "@/lib/steps"
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
  outcomeRescheduleField?: DateField
  bastChoice?: boolean
}

export function MarkDoneDialog({
  projectId,
  stepCode,
  stepName,
  completionMode = "normal",
  checklist,
  dateInputs,
  hasOutcome,
  outcomeRescheduleField = "ex_work_date",
  bastChoice,
}: MarkDoneDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [completedOpen, setCompletedOpen] = useState(false)
  const [note, setNote] = useState("")
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set())
  const [checklistItemNotes, setChecklistItemNotes] = useState<Record<string, string>>({})
  const [dateValues, setDateValues] = useState<Record<string, string>>({})
  const [outcome, setOutcome] = useState<"ok" | "reschedule" | "">("")
  const [rescheduleDate, setRescheduleDate] = useState("")
  const [bast2Required, setBast2Required] = useState<boolean | null>(null)
  const [bastEstimate, setBastEstimate] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const showChecklist =
    requiresChecklist(completionMode) && checklist && checklist.length > 0
  const noteRequired = requiresKeterangan(completionMode)
  const isReschedule = hasOutcome && outcome === "reschedule"
  const showDateInputs =
    !!dateInputs && dateInputs.length > 0 && (!hasOutcome || outcome === "ok")

  function resetState() {
    setNote("")
    setCheckedItems(new Set())
    setChecklistItemNotes({})
    setDateValues({})
    setOutcome("")
    setRescheduleDate("")
    setBast2Required(null)
    setBastEstimate("")
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
    isReschedule ||
    checklist!.every((item) =>
      isChecklistItemComplete({
        item,
        checked: checkedItems.has(item),
        note: checklistItemNotes[item],
      })
    )
  const dateInputsComplete =
    !showDateInputs || dateInputs!.every((input) => !!dateValues[input.field])
  const outcomeComplete =
    !hasOutcome ||
    outcome === "ok" ||
    (outcome === "reschedule" && !!rescheduleDate)
  const bastComplete =
    !bastChoice ||
    isReschedule ||
    (bast2Required !== null && bastEstimate.trim().length > 0)
  const noteComplete = !noteRequired || isReschedule || note.trim().length > 0

  const canSubmit =
    checklistComplete &&
    dateInputsComplete &&
    outcomeComplete &&
    bastComplete &&
    noteComplete

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result = await completeStep(projectId, stepCode, {
        note,
        checkedItems: showChecklist && !isReschedule ? Array.from(checkedItems) : undefined,
        checklistItemNotes: showChecklist && !isReschedule ? checklistItemNotes : undefined,
        dateInputs: showDateInputs ? dateValues : undefined,
        outcome: hasOutcome ? outcome || undefined : undefined,
        rescheduleDate: outcome === "reschedule" ? rescheduleDate : undefined,
        bast2Required: bastChoice && !isReschedule ? bast2Required ?? undefined : undefined,
        bastEstimate: bastChoice && !isReschedule ? bastEstimate : undefined,
      })
      if (result.success) {
        setOpen(false)
        resetState()
        if (result.projectCompleted) {
          setCompletedOpen(true)
        } else {
          router.refresh()
        }
        return
      }
      setError(result.error)
    })
  }

  return (
    <>
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
                <Label>Hasil</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={outcome === "ok" ? "default" : "outline"}
                    onClick={() => setOutcome("ok")}
                  >
                    OK
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
                      Tanggal baru — {DATE_FIELD_LABELS[outcomeRescheduleField]}
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

            {bastChoice && !isReschedule && (
              <div className="flex flex-col gap-3 rounded-md border p-3">
                <Label>Pilihan BAST</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={bast2Required === false ? "default" : "outline"}
                    onClick={() => setBast2Required(false)}
                  >
                    Hanya BAST 1
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={bast2Required === true ? "default" : "outline"}
                    onClick={() => setBast2Required(true)}
                  >
                    Ada BAST 1 &amp; BAST 2
                  </Button>
                </div>
                {bast2Required === false && (
                  <p className="text-xs text-muted-foreground">
                    Step BAST 2 (P9 / A8) akan dilewati otomatis.
                  </p>
                )}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="bast-estimate" className="text-xs">
                    Estimasi BAST (wajib)
                  </Label>
                  <Input
                    id="bast-estimate"
                    placeholder="Cth: 15 Agustus 2026 / minggu ke-3"
                    value={bastEstimate}
                    onChange={(e) => setBastEstimate(e.target.value)}
                  />
                </div>
              </div>
            )}

            {showChecklist && !isReschedule && (
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

            {showDateInputs && (
              <div className="grid gap-3 sm:grid-cols-2">
                {dateInputs!.map((input) => (
                  <div key={input.field} className="flex flex-col gap-1.5">
                    <Label htmlFor={`date-${input.field}`} className="text-xs">
                      {input.label}
                    </Label>
                    <Input
                      id={`date-${input.field}`}
                      type="date"
                      value={dateValues[input.field] ?? ""}
                      onChange={(e) =>
                        setDateValues((prev) => ({
                          ...prev,
                          [input.field]: e.target.value,
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            )}

            {!isReschedule && (noteRequired || !showChecklist) && (
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

      <ProjectCompletedDialog
        open={completedOpen}
        onOpenChange={(next) => {
          setCompletedOpen(next)
          if (!next) router.refresh()
        }}
      />
    </>
  )
}
