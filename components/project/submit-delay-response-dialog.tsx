"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { submitDelayResponse } from "@/app/actions/delay-response"
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
import { addDaysToDateKey, todayDateKeyWib } from "@/lib/format"

const QUICK_OFFSETS = [1, 3, 7, 14] as const

type SubmitDelayResponseDialogProps = {
  projectId: string
  stepCode: string
  stepName: string
  adminNote?: string | null
}

export function SubmitDelayResponseDialog({
  projectId,
  stepCode,
  stepName,
  adminNote,
}: SubmitDelayResponseDialogProps) {
  const router = useRouter()
  const today = todayDateKeyWib()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [requestedUntil, setRequestedUntil] = useState(
    addDaysToDateKey(today, 3)
  )
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      setReason("")
      setRequestedUntil(addDaysToDateKey(today, 3))
      setError(null)
    }
  }

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result = await submitDelayResponse(
        projectId,
        stepCode,
        reason,
        requestedUntil
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
        <Button size="sm">Isi alasan delay</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Response delay</DialogTitle>
          <DialogDescription>
            Step {stepCode}: {stepName}. Jelaskan kenapa delay dan minta waktu
            sampai kapan. Admin akan review & approve.
          </DialogDescription>
        </DialogHeader>

        {adminNote && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Catatan admin: {adminNote}
          </p>
        )}

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="delay-reason">Alasan delay</Label>
            <Textarea
              id="delay-reason"
              placeholder="Contoh: menunggu konfirmasi pabrik, dokumen belum lengkap…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="delay-until">Minta waktu sampai</Label>
            <Input
              id="delay-until"
              type="date"
              min={today}
              value={requestedUntil}
              onChange={(e) => setRequestedUntil(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {QUICK_OFFSETS.map((days) => (
                <Button
                  key={days}
                  type="button"
                  size="sm"
                  variant={
                    requestedUntil === addDaysToDateKey(today, days)
                      ? "default"
                      : "outline"
                  }
                  onClick={() =>
                    setRequestedUntil(addDaysToDateKey(today, days))
                  }
                >
                  +{days} hari
                </Button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => setOpen(false)}
          >
            Batal
          </Button>
          <Button type="button" disabled={isPending} onClick={handleSubmit}>
            {isPending ? "Mengirim…" : "Kirim ke admin"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
