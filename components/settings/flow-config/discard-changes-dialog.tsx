"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function DiscardChangesDialog({
  open,
  onOpenChange,
  onDiscard,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDiscard: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Buang perubahan?</DialogTitle>
          <DialogDescription>
            Ada perubahan yang belum disimpan. Buang perubahan dan tutup panel?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Lanjut edit
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onDiscard()
              onOpenChange(false)
            }}
          >
            Buang perubahan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
