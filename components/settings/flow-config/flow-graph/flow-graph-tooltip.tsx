"use client"

import type { FlowConfigRow } from "@/components/settings/flow-config-table"
import { getDivisionLabel, type Division } from "@/lib/steps"
import { cn } from "@/lib/utils"

export function FlowGraphTooltip({
  row,
  displayName,
  triggerSummary,
  className,
}: {
  row: FlowConfigRow
  displayName: string
  triggerSummary: string
  className?: string
}) {
  const division = row.division as Division

  return (
    <div
      className={cn(
        "pointer-events-none z-50 w-64 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg",
        className
      )}
    >
      <p className="font-mono text-sm font-bold">{row.code}</p>
      <p className="mt-0.5 text-xs font-medium">{displayName}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {getDivisionLabel(division)}
      </p>

      <div className="mt-3 space-y-2 border-t pt-2 text-[11px]">
        <div>
          <p className="font-semibold text-foreground">Notif</p>
          <p className="text-muted-foreground">{triggerSummary || "—"}</p>
        </div>
        <div>
          <p className="font-semibold text-foreground">Unlocks</p>
          <p className="text-muted-foreground">
            {row.unlocksSteps.length > 0 ? row.unlocksSteps.join(", ") : "None"}
          </p>
        </div>
        <div>
          <p className="font-semibold text-foreground">Dependencies</p>
          <p className="text-muted-foreground">
            {row.prerequisites.length > 0 ? row.prerequisites.join(", ") : "None"}
          </p>
        </div>
        <div>
          <p className="font-semibold text-foreground">Sub-step</p>
          <p className="text-muted-foreground">
            {row.substeps.length > 0
              ? `${row.substeps.length} item${row.substeps.length > 1 ? "s" : ""}`
              : "None"}
          </p>
        </div>
      </div>
    </div>
  )
}
