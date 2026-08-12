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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { todayDateKeyWib } from "@/lib/format"
import { DATE_FIELD_LABELS, type DateField, type DateInputField } from "@/lib/steps"
import { isChecklistItemComplete } from "@/lib/steps/checklist-response"
import {
  COMPLETION_MODE_LABELS,
  allowsChecklistItemNotes,
  requiresChecklist,
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
  noteRouteTargets?: { code: string; name: string }[]
}

export function MarkDoneDialog({
  projectId,
  stepCode,
  stepName,
  completionMode = "normal",
  checklist,
  dateInputs,
  hasOutcome,
  outcomeRescheduleField,
  bastChoice,
  noteRouteTargets = [],
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
  const [noteRoutePresence, setNoteRoutePresence] = useState<"ada" | "tidak" | "">(
    ""
  )
  const [noteRouteTo, setNoteRouteTo] = useState("")
  const [noteRouteMessage, setNoteRouteMessage] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const showChecklist =
    requiresChecklist(completionMode) && checklist && checklist.length > 0
  const itemNotesAllowed = allowsChecklistItemNotes(completionMode)
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
    setNoteRoutePresence("")
    setNoteRouteTo(noteRouteTargets.length === 1 ? noteRouteTargets[0].code : "")
    setNoteRouteMessage("")
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
      isChecklistItemComplete(
        {
          item,
          checked: checkedItems.has(item),
          note: checklistItemNotes[item],
        },
        { allowItemNotes: itemNotesAllowed }
      )
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
  const showNoteRoute = noteRouteTargets.length > 0 && !isReschedule
  const noteRouteComplete =
    !showNoteRoute ||
    noteRoutePresence === "tidak" ||
    (noteRoutePresence === "ada" &&
      noteRouteMessage.trim().length > 0 &&
      noteRouteTargets.some((target) => target.code === noteRouteTo))

  const canSubmit =
    checklistComplete &&
    dateInputsComplete &&
    outcomeComplete &&
    bastComplete &&
    noteRouteComplete

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
        noteRoutePresence: showNoteRoute ? noteRoutePresence || undefined : undefined,
        noteRouteTo:
          showNoteRoute && noteRoutePresence === "ada" ? noteRouteTo : undefined,
        noteRouteMessage:
          showNoteRoute && noteRoutePresence === "ada" ? noteRouteMessage : undefined,
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
              <div className="flex flex-col gap-2 rounded-md border p-3">
                <Label>Selesai / Belum</Label>
                <p className="text-xs text-muted-foreground">
                  Kalau belum, pilih tanggal berikutnya. Step tetap aktif dan
                  ditanya lagi di tanggal itu.
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={outcome === "ok" ? "default" : "outline"}
                    onClick={() => setOutcome("ok")}
                  >
                    Selesai
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={outcome === "reschedule" ? "default" : "outline"}
                    onClick={() => setOutcome("reschedule")}
                  >
                    Belum
                  </Button>
                </div>
                {outcome === "reschedule" && (
                  <div className="mt-1 flex flex-col gap-1.5">
                    <Label htmlFor="reschedule-date" className="text-xs">
                      Tanggal berikutnya
                      {outcomeRescheduleField
                        ? ` — juga geser ${DATE_FIELD_LABELS[outcomeRescheduleField]}`
                        : ""}
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

            {showNoteRoute && (
              <div className="flex flex-col gap-3 rounded-md border p-3">
                <Label>Ada / Tidak</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={noteRoutePresence === "ada" ? "default" : "outline"}
                    onClick={() => setNoteRoutePresence("ada")}
                  >
                    Ada
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={noteRoutePresence === "tidak" ? "default" : "outline"}
                    onClick={() => setNoteRoutePresence("tidak")}
                  >
                    Tidak
                  </Button>
                </div>
                {noteRoutePresence === "ada" && (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="note-route-message" className="text-xs">
                        Catatan untuk step berikutnya (wajib)
                      </Label>
                      <Textarea
                        id="note-route-message"
                        placeholder="Tulis catatan yang diteruskan ke step tujuan…"
                        value={noteRouteMessage}
                        onChange={(e) => setNoteRouteMessage(e.target.value)}
                        rows={3}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs">Teruskan ke</Label>
                      <Select value={noteRouteTo || undefined} onValueChange={setNoteRouteTo}>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih step" />
                        </SelectTrigger>
                        <SelectContent>
                          {noteRouteTargets.map((target) => (
                            <SelectItem key={target.code} value={target.code}>
                              {target.code} — {target.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
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
                allowItemNotes={itemNotesAllowed}
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

            {!isReschedule && !showChecklist && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="note">Catatan (opsional)</Label>
                <Textarea
                  id="note"
                  placeholder="Tambahkan catatan jika perlu…"
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
