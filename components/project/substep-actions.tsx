"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Undo2 } from "lucide-react"

import { completeSubstep, undoSubstep } from "@/app/actions/complete-substep"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { formatDateKey, formatDateTime, todayDateKeyWib } from "@/lib/format"
import type { SubstepDefinition, SubstepCompletion } from "@/lib/steps/substeps"
import {
  canCompleteSubstepNow,
  getCompletedSubstepKeys,
  getSubstepKind,
} from "@/lib/steps/substeps"

type SubstepActionsProps = {
  projectId: string
  stepCode: string
  substeps: SubstepDefinition[]
  completions: SubstepCompletion[]
  canEdit: boolean
}

function eventDateLabel(substepKey: string, substepLabel: string): string {
  if (substepKey === "tagih" || substepLabel.toLowerCase().includes("tagih")) {
    return "Tanggal tagihan (opsional)"
  }
  if (substepKey === "received" || substepLabel.toLowerCase().includes("diterima")) {
    return "Tanggal pembayaran diterima (opsional)"
  }
  if (substepKey === "sent" || substepLabel.toLowerCase().includes("terkirim")) {
    return "Tanggal terkirim (opsional)"
  }
  return "Tanggal kejadian (opsional)"
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
  const [eventDate, setEventDate] = useState("")
  const [note, setNote] = useState("")

  if (substeps.length === 0) return null

  const completedKeys = getCompletedSubstepKeys(stepCode, completions)
  const stepCompletions = completions.filter((c) => c.stepCode === stepCode)

  function openConfirm(substep: SubstepDefinition) {
    setError(null)
    setEventDate(todayDateKeyWib())
    setNote("")
    setPendingSubstep(substep)
  }

  function closeConfirm() {
    if (isPending) return
    setPendingSubstep(null)
  }

  function handleConfirm() {
    if (!pendingSubstep) return
    setError(null)
    startTransition(async () => {
      const result = await completeSubstep(projectId, stepCode, pendingSubstep.key, {
        eventDate: eventDate || undefined,
        note: note || undefined,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      setPendingSubstep(null)
      router.refresh()
    })
  }

  function handleUndo(substepKey: string) {
    setError(null)
    startTransition(async () => {
      const result = await undoSubstep(projectId, stepCode, substepKey)
      if (!result.success) {
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
            const actionable =
              canEdit && canCompleteSubstepNow(substep, substeps, completedKeys)

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
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={isPending}
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
                      onClick={() => openConfirm(substep)}
                    >
                      {substep.label}
                    </Button>
                  ) : (
                    <span className="text-sm text-muted-foreground">{substep.label}</span>
                  )}
                </div>
                {done && completion && (
                  <div className="text-xs text-muted-foreground">
                    <p>Dicatat: {formatDateTime(completion.completedAt)}</p>
                    {completion.eventDate && (
                      <p>Tanggal: {formatDateKey(completion.eventDate)}</p>
                    )}
                    {completion.note && (
                      <p className="italic">&ldquo;{completion.note}&rdquo;</p>
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
      </div>

      <Dialog open={!!pendingSubstep} onOpenChange={(open) => !open && closeConfirm()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{pendingSubstep?.label}</DialogTitle>
            <DialogDescription>
              {stepCode} — konfirmasi sub-step ini selesai. Waktu submit dicatat otomatis
              saat Anda klik Simpan.
              {pendingSubstep && getSubstepKind(pendingSubstep) === "reminder" && (
                <span className="mt-1 block">
                  Sub-step reminder tidak memblokir unlock step berikutnya.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            {pendingSubstep && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="substep-event-date">
                  {eventDateLabel(pendingSubstep.key, pendingSubstep.label)}
                </Label>
                <Input
                  id="substep-event-date"
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  disabled={isPending}
                />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="substep-note">Catatan (opsional)</Label>
              <Textarea
                id="substep-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={isPending}
                rows={2}
              />
            </div>
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
            <Button type="button" onClick={handleConfirm} disabled={isPending}>
              {isPending ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
