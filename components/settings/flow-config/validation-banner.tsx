"use client"

import { AlertTriangle, ChevronDown } from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import type { FlowConfigRow } from "@/components/settings/flow-config-table"
import { validateFlowConfig } from "@/lib/flow-config/validate-flow"
import { cn } from "@/lib/utils"

export function FlowValidationBanner({ rows }: { rows: FlowConfigRow[] }) {
  const issues = useMemo(() => validateFlowConfig(rows), [rows])
  const [open, setOpen] = useState(true)

  if (issues.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
        ✓ Konfigurasi flow valid — tidak ada masalah terdeteksi.
      </div>
    )
  }

  const errors = issues.filter((i) => i.severity === "error")
  const warnings = issues.filter((i) => i.severity === "warning")

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2",
        errors.length > 0
          ? "border-destructive/30 bg-destructive/5"
          : "border-amber-200 bg-amber-50"
      )}
    >
      <Button
        type="button"
        variant="ghost"
        className="flex h-auto w-full items-center justify-between px-0 py-0 hover:bg-transparent"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2 text-xs font-medium">
          <AlertTriangle
            className={cn(
              "size-4 shrink-0",
              errors.length > 0 ? "text-destructive" : "text-amber-600"
            )}
          />
          {errors.length > 0
            ? `${errors.length} error, ${warnings.length} peringatan`
            : `${warnings.length} peringatan konfigurasi`}
        </span>
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </Button>
      {open && (
        <ul className="mt-2 flex flex-col gap-1 text-xs">
          {issues.map((issue, index) => (
            <li
              key={`${issue.stepCode ?? "global"}-${index}`}
              className={cn(
                issue.severity === "error" ? "text-destructive" : "text-amber-800"
              )}
            >
              {issue.severity === "error" ? "✗" : "⚠"} {issue.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
