"use client"

import { memo } from "react"
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"

import type { FlowStepNodeData } from "@/lib/flow-config/graph-layout"
import {
  DIVISION_BADGE_STYLES,
  getDivisionLabel,
  type Division,
} from "@/lib/steps"
import {
  COMPLETION_MODE_BADGES,
  COMPLETION_MODE_LABELS,
} from "@/lib/steps/completion-mode"
import { cn } from "@/lib/utils"

function FlowStepNodeComponent({ data }: NodeProps<Node<FlowStepNodeData>>) {
  const { row, displayName, selected, highlighted } = data
  const division = row.division as Division
  const styles = DIVISION_BADGE_STYLES[division]
  const hasSubsteps = row.substeps.length > 0

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2 !border-2 !border-background !bg-muted-foreground"
      />
      <div
        className={cn(
          "w-[248px] overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow",
          "border-l-4",
          styles?.border ?? "border-l-border",
          selected && "border-primary ring-2 ring-primary/30 shadow-md",
          highlighted && !selected && "ring-2 ring-amber-400/50",
          !selected && !highlighted && "hover:shadow-md"
        )}
      >
        <div className="flex flex-col gap-2 p-3">
          <div className="flex items-start justify-between gap-2">
            <span className="font-mono text-sm font-bold leading-none">{row.code}</span>
            {data.isCollapsed && data.hasChildren && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                collapsed
              </span>
            )}
          </div>
          <p className="line-clamp-2 text-xs font-medium leading-snug text-foreground">
            {displayName}
          </p>
          <div className="flex flex-wrap gap-1">
            {styles && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                  styles.badge
                )}
              >
                {getDivisionLabel(division)}
              </span>
            )}
            <span className="rounded-full border px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
              Tahap {row.stage}
            </span>
            {hasSubsteps ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                  COMPLETION_MODE_BADGES.normal
                )}
              >
                Sub-step
              </span>
            ) : (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                  COMPLETION_MODE_BADGES[row.completionMode]
                )}
              >
                {COMPLETION_MODE_LABELS[row.completionMode]}
              </span>
            )}
          </div>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!size-2 !border-2 !border-background !bg-muted-foreground"
      />
    </>
  )
}

export const FlowStepNode = memo(FlowStepNodeComponent)

export const flowStepNodeTypes = {
  flowStep: FlowStepNode,
}
