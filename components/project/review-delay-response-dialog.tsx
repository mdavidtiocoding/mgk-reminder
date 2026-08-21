"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { reviewDelayResponse } from "@/app/actions/delay-response"
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
import { formatDateKey } from "@/lib/format"

type ReviewDelayResponseDialogProps = {
  projectId: string
  stepCode: string
  stepName: string
  reason: string
  requestedUntil: string
}

export function ReviewDelayResponseDialog({
  projectId,
  stepCode,
  stepName,
  reason,
  requestedUntil,
}: ReviewDelayResponseDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reviewNote, setReviewNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      setReviewNote("")
      setError(null)
    }
  }

  function handleReview(decision: "approved" | "rejected") {
    setError(null)
    startTransition(async () => {
      const result = await reviewDelayResponse(
        projectId,
        stepCode,
        decision,
        reviewNote
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
        <Button size="sm">Review & approve</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review response delay</DialogTitle>
          <DialogDescription>
            Step {stepCode}: {stepName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <p>
            <span className="text-muted-foreground">Alasan: </span>
            {reason}
          </p>
          <p>
            <span className="text-muted-foreground">Minta sampai: </span>
            {formatDateKey(requestedUntil)}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="delay-review-note">Catatan (opsional)</Label>
          <Textarea
            id="delay-review-note"
            placeholder="Contoh: OK, pantau ETA…"
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
          />
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => handleReview("rejected")}
          >
            Tolak
          </Button>
          <Button
            type="button"
            disabled={isPending}
            onClick={() => handleReview("approved")}
          >
            {isPending ? "Menyimpan…" : "Approve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
