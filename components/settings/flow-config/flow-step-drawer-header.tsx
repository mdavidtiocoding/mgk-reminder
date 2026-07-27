"use client"

import { Badge } from "@/components/ui/badge"
import type { FlowConfigRow } from "@/components/settings/flow-config-table"
import {
  DIVISION_BADGE_STYLES,
  STAGE_LABELS,
  getDivisionLabel,
  type Division,
} from "@/lib/steps"
import {
  COMPLETION_MODE_BADGES,
  COMPLETION_MODE_LABELS,
} from "@/lib/steps/completion-mode"
import { cn } from "@/lib/utils"

export function FlowStepDrawerHeader({
  row,
  displayName,
  mode,
  hasUnsavedChanges,
}: {
  row: FlowConfigRow
  displayName: string
  mode: "view" | "edit"
  hasUnsavedChanges?: boolean
}) {
  const division = row.division as Division
  const badgeStyle = DIVISION_BADGE_STYLES[division]
  const hasSubsteps = row.substeps.length > 0

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <Badge
          variant="outline"
          className={cn(
            "shrink-0 text-[10px] font-semibold uppercase tracking-wide",
            mode === "view" && "border-muted-foreground/30 text-muted-foreground",
            mode === "edit" && "border-primary/40 bg-primary/10 text-primary"
          )}
        >
          {mode === "view" ? "👁 Viewing" : "✏️ Editing"}
        </Badge>
        {hasUnsavedChanges && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
            <span className="size-2 rounded-full bg-amber-500" aria-hidden />
            Unsaved changes
          </span>
        )}
      </div>

      <div>
        <p className="font-mono text-2xl font-bold leading-none">{row.code}</p>
        <p className="mt-1.5 text-base font-medium leading-snug">{displayName}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {getDivisionLabel(division)} · Tahap {row.stage}
          {STAGE_LABELS[row.stage] ? ` (${STAGE_LABELS[row.stage]})` : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {badgeStyle && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
              badgeStyle.badge
            )}
          >
            {getDivisionLabel(division)}
          </span>
        )}
        <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium">
          Tahap {row.stage}
        </span>
        {hasSubsteps ? (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
              COMPLETION_MODE_BADGES.normal
            )}
          >
            Sub-step
          </span>
        ) : (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
              COMPLETION_MODE_BADGES[row.completionMode]
            )}
          >
            {COMPLETION_MODE_LABELS[row.completionMode]}
          </span>
        )}
      </div>
    </div>
  )
}
