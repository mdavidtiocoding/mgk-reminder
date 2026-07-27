"use client"

import dynamic from "next/dynamic"

import type { FlowConfigRow } from "@/components/settings/flow-config-table"
import type { FlowPageMode } from "@/components/settings/flow-config/flow-step-drawer-types"
import { cn } from "@/lib/utils"

const FlowGraphCanvas = dynamic(
  () =>
    import("@/components/settings/flow-config/flow-graph/flow-graph-canvas").then(
      (m) => m.FlowGraphCanvas
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[420px] items-center justify-center rounded-xl border bg-muted/10 text-sm text-muted-foreground">
        Loading workflow graph…
      </div>
    ),
  }
)

export function FlowGraphView({
  rows,
  nameByCode,
  pageMode,
  onOpenNode,
  compact = false,
  className,
}: {
  rows: FlowConfigRow[]
  nameByCode: Map<string, string>
  pageMode: FlowPageMode
  onOpenNode: (code: string) => void
  compact?: boolean
  className?: string
}) {
  return (
    <FlowGraphCanvas
      rows={rows}
      nameByCode={nameByCode}
      pageMode={pageMode}
      onOpenNode={onOpenNode}
      compact={compact}
      className={cn(className)}
    />
  )
}
