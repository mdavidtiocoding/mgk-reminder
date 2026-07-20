"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { setFollowUp } from "@/app/actions/followup"
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
import {
  addDaysToDateKey,
  formatFollowUpSchedule,
  parseTimeKey,
  todayDateKeyWib,
} from "@/lib/format"

const QUICK_OFFSETS = [1, 3, 7, 14] as const
const DEFAULT_TIME = "09:00"

function toTimeInputValue(timeKey?: string): string {
  if (!timeKey) return DEFAULT_TIME
  const { hour, minute } = parseTimeKey(timeKey)
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

type SetFollowUpDialogProps = {
  projectId: string
  stepCode: string
  stepName: string
  existingDate?: string
  existingTime?: string
  existingNote?: string | null
}

export function SetFollowUpDialog({
  projectId,
  stepCode,
  stepName,
  existingDate,
  existingTime,
  existingNote,
}: SetFollowUpDialogProps) {
  const router = useRouter()
  const today = todayDateKeyWib()
  const [open, setOpen] = useState(false)
  const [scheduledDate, setScheduledDate] = useState(
    existingDate ?? addDaysToDateKey(today, 3)
  )
  const [scheduledTime, setScheduledTime] = useState(toTimeInputValue(existingTime))
  const [note, setNote] = useState(existingNote ?? "")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      setScheduledDate(existingDate ?? addDaysToDateKey(today, 3))
      setScheduledTime(toTimeInputValue(existingTime))
      setNote(existingNote ?? "")
      setError(null)
    }
  }

  function applyQuickOffset(days: number) {
    setScheduledDate(addDaysToDateKey(today, days))
  }

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result = await setFollowUp(
        projectId,
        stepCode,
        scheduledDate,
        scheduledTime,
        note
      )
      if (!result.success) {
        setError(result.error)
        return
      }
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Atur Follow-up
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Jadwalkan follow-up</DialogTitle>
          <DialogDescription>
            Step {stepCode}: {stepName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="followup-date">Tanggal</Label>
              <Input
                id="followup-date"
                type="date"
                min={today}
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="followup-time">Jam (WIB)</Label>
              <Input
                id="followup-time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
              />
            </div>
          </div>

          {scheduledDate && scheduledTime && (
            <p className="text-xs text-muted-foreground">
              {formatFollowUpSchedule(scheduledDate, `${scheduledTime}:00`)} ·
              Google Calendar: notifikasi 30 & 10 menit sebelum + saat jadwal
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Label>Cepat</Label>
            <div className="flex flex-wrap gap-2">
              {QUICK_OFFSETS.map((days) => (
                <Button
                  key={days}
                  type="button"
                  size="sm"
                  variant={
                    scheduledDate === addDaysToDateKey(today, days)
                      ? "default"
                      : "outline"
                  }
                  onClick={() => applyQuickOffset(days)}
                >
                  +{days} hari
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="followup-note">Catatan (opsional)</Label>
            <Textarea
              id="followup-note"
              placeholder="Contoh: telpon pabrik cek ETA..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
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
          <Button
            onClick={handleSubmit}
            disabled={isPending || !scheduledDate || !scheduledTime}
          >
            {isPending ? "Menyimpan..." : "Simpan jadwal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
