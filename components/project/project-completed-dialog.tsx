"use client"

import Link from "next/link"
import { PartyPopper } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function ProjectCompletedDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PartyPopper className="size-5 text-primary" aria-hidden />
            Project telah selesai
          </DialogTitle>
          <DialogDescription>
            Semua step sudah complete. Project ditandai selesai.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button asChild>
            <Link href="/">Kembali ke Dashboard</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
