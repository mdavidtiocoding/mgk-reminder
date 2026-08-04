"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Undo2 } from "lucide-react"

import { undoStep } from "@/app/actions/undo-step"
import { Button } from "@/components/ui/button"

type StepUndoButtonProps = {
  projectId: string
  stepCode: string
  disabled?: boolean
}

export function StepUndoButton({
  projectId,
  stepCode,
  disabled = false,
}: StepUndoButtonProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleUndo() {
    setError(null)
    startTransition(async () => {
      const result = await undoStep(projectId, stepCode)
      if (!result.success) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        disabled={disabled || isPending}
        onClick={handleUndo}
      >
        <Undo2 className="mr-1.5 size-3.5" />
        {isPending ? "Membatalkan…" : "Batalkan selesai"}
      </Button>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
