"use client"

import { useEffect, useState, useTransition } from "react"

import { duplicateStepConfig } from "@/app/actions/flow-config"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AllStepOption } from "@/components/settings/flow-config/flow-step-drawer-types"

export function DuplicateStepDialog({
  open,
  onOpenChange,
  sourceCode,
  sourceName,
  allStepOptions,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceCode: string
  sourceName: string
  allStepOptions: AllStepOption[]
  onSuccess: () => void
}) {
  const [targetCode, setTargetCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (open) {
      setTargetCode("")
      setError(null)
    }
  }, [open])

  const targets = allStepOptions.filter((o) => o.code !== sourceCode)

  function handleDuplicate() {
    if (!targetCode) return
    setError(null)
    startTransition(async () => {
      const result = await duplicateStepConfig(sourceCode, targetCode)
      if (result.success) {
        onSuccess()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Duplikat step — {sourceCode}</DialogTitle>
          <DialogDescription>
            Salin prasyarat, mode selesai, checklist, dan sub-step dari{" "}
            <strong>{sourceName}</strong> ke step lain. Trigger tetap mengikuti
            definisi workflow bawaan masing-masing step.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 py-2">
          <Label>Step tujuan</Label>
          <Select value={targetCode} onValueChange={setTargetCode}>
            <SelectTrigger>
              <SelectValue placeholder="Pilih step…" />
            </SelectTrigger>
            <SelectContent>
              {targets.map((option) => (
                <SelectItem key={option.code} value={option.code}>
                  {option.code} — {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Batal
          </Button>
          <Button onClick={handleDuplicate} disabled={isPending || !targetCode}>
            {isPending ? "Menyalin…" : "Duplikat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
