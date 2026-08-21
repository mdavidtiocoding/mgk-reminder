"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { pushDelayResponse } from "@/app/actions/delay-response"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type PushDelayResponseDialogProps = {
  projectId: string
  stepCode: string
  stepName: string
}

export function PushDelayResponseDialog({
  projectId,
  stepCode,
  stepName,
}: PushDelayResponseDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [adminNote, setAdminNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      setAdminNote("")
      setError(null)
    }
  }

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result = await pushDelayResponse(projectId, stepCode, adminNote)
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
        <Button size="sm">Minta response</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Minta response delay</DialogTitle>
          <DialogDescription>
            Step {stepCode}: {stepName}. Divisi PIC akan dapat notice dan harus
            isi alasan delay + minta waktu sampai kapan.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="delay-push-note">Catatan ke divisi (opsional)</Label>
          <Textarea
            id="delay-push-note"
            placeholder="Contoh: mohon update ETA & alasan keterlambatan…"
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
          />
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
            {isPending ? "Mengirim…" : "Kirim ke divisi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
