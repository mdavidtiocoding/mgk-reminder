"use client"

import { GitBranch } from "lucide-react"

export function FlowGraphEmpty() {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/10 p-8 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted">
        <GitBranch className="size-8 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">No workflow available.</p>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">
        Tidak ada step yang cocok dengan filter saat ini, atau workflow belum
        dikonfigurasi.
      </p>
    </div>
  )
}
