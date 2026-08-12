"use client"

import { useCallback, useMemo, useState } from "react"
import {
  Background,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type NodeMouseHandler,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { FlowGraphEmpty } from "@/components/settings/flow-config/flow-graph/flow-graph-empty"
import { FlowGraphToolbar } from "@/components/settings/flow-config/flow-graph/flow-graph-toolbar"
import { FlowGraphTooltip } from "@/components/settings/flow-config/flow-graph/flow-graph-tooltip"
import { flowStepNodeTypes } from "@/components/settings/flow-config/flow-graph/flow-step-node"
import type { FlowConfigRow } from "@/components/settings/flow-config-table"
import type { FlowPageMode } from "@/components/settings/flow-config/flow-step-drawer-types"
import {
  buildFlowGraphElements,
  getAllCollapsibleCodes,
  type FlowStepNodeData,
} from "@/lib/flow-config/graph-layout"
import { cn } from "@/lib/utils"

type FlowGraphCanvasProps = {
  rows: FlowConfigRow[]
  nameByCode: Map<string, string>
  pageMode: FlowPageMode
  onOpenNode: (code: string) => void
  compact?: boolean
  className?: string
}

function FlowGraphCanvasInner({
  rows,
  nameByCode,
  pageMode,
  onOpenNode,
  compact = false,
  className,
}: FlowGraphCanvasProps) {
  const { fitView, zoomIn, zoomOut } = useReactFlow()
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(() => new Set())
  const [hovered, setHovered] = useState<{
    row: FlowConfigRow
    displayName: string
    triggerSummary: string
    x: number
    y: number
  } | null>(null)

  const triggerSummaryByCode = useMemo(() => {
    const map = new Map<string, string>()
    for (const row of rows) {
      map.set(row.code, "Saat unlock: notif + kalender")
    }
    return map
  }, [rows])

  const { nodes, edges } = useMemo(
    () =>
      buildFlowGraphElements(rows, nameByCode, triggerSummaryByCode, {
        collapsedNodes,
        searchQuery: search,
        selectedCode,
      }),
    [rows, nameByCode, triggerSummaryByCode, collapsedNodes, search, selectedCode]
  )

  const onNodeClick: NodeMouseHandler<Node<FlowStepNodeData>> = useCallback(
    (_event, node) => {
      setSelectedCode(node.id)
    },
    []
  )

  const onNodeDoubleClick: NodeMouseHandler<Node<FlowStepNodeData>> = useCallback(
    (_event, node) => {
      if (pageMode !== "edit") return
      onOpenNode(node.id)
    },
    [onOpenNode, pageMode]
  )

  const onNodeMouseEnter: NodeMouseHandler<Node<FlowStepNodeData>> = useCallback(
    (event, node) => {
      const row = rows.find((r) => r.code === node.id)
      if (!row) return
      setHovered({
        row,
        displayName: nameByCode.get(row.code) ?? row.name,
        triggerSummary: triggerSummaryByCode.get(row.code) ?? "",
        x: event.clientX,
        y: event.clientY,
      })
    },
    [rows, nameByCode, triggerSummaryByCode]
  )

  const onNodeMouseLeave = useCallback(() => {
    setHovered(null)
  }, [])

  if (rows.length === 0) {
    return <FlowGraphEmpty />
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <FlowGraphToolbar
        search={search}
        onSearchChange={setSearch}
        onZoomIn={() => zoomIn({ duration: 200 })}
        onZoomOut={() => zoomOut({ duration: 200 })}
        onFitView={() => fitView({ padding: 0.18, duration: 300 })}
        onExpandAll={() => setCollapsedNodes(new Set())}
        onCollapseAll={() => setCollapsedNodes(new Set(getAllCollapsibleCodes(rows)))}
        compact={compact}
      />

      <div className="relative h-[min(72vh,720px)] min-h-[420px] overflow-hidden rounded-xl border bg-muted/15">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={flowStepNodeTypes}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          fitView
          fitViewOptions={{ padding: 0.18 }}
          minZoom={0.08}
          maxZoom={2}
          onlyRenderVisibleElements
          proOptions={{ hideAttribution: true }}
          panOnScroll
          selectionOnDrag={false}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          defaultEdgeOptions={{
            type: "default",
            animated: false,
          }}
        >
          <Background gap={20} size={1} color="var(--border)" />
          <MiniMap
            className="!bottom-3 !right-3 !rounded-lg !border !bg-background/90 !shadow-md"
            nodeColor={(node) => {
              const data = node.data as FlowStepNodeData
              if (data.selected) return "var(--primary)"
              if (data.highlighted) return "rgb(251 191 36)"
              return "var(--muted-foreground)"
            }}
            maskColor="rgb(0 0 0 / 0.08)"
            pannable
            zoomable
          />
        </ReactFlow>

        {hovered && typeof window !== "undefined" && (
          <div
            className="fixed z-[100]"
            style={{
              left: Math.min(hovered.x + 14, window.innerWidth - 280),
              top: Math.min(hovered.y + 14, window.innerHeight - 220),
            }}
          >
            <FlowGraphTooltip
              row={hovered.row}
              displayName={hovered.displayName}
              triggerSummary={hovered.triggerSummary}
            />
          </div>
        )}

        <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border bg-background/90 px-2 py-1 text-[10px] text-muted-foreground shadow-sm">
          {pageMode === "edit"
            ? "Klik = pilih · Double-klik = buka panel edit"
            : "Mode lihat — double-klik nonaktif, switch ke Edit dulu"}
        </div>
      </div>
    </div>
  )
}

export function FlowGraphCanvas(props: FlowGraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowGraphCanvasInner {...props} />
    </ReactFlowProvider>
  )
}
