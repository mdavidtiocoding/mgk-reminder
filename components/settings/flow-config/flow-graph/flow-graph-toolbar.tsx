"use client"

import {
  FolderClosed,
  FolderOpen,
  Maximize2,
  Minus,
  Plus,
  Search,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type FlowGraphToolbarProps = {
  search: string
  onSearchChange: (value: string) => void
  onZoomIn: () => void
  onZoomOut: () => void
  onFitView: () => void
  onExpandAll: () => void
  onCollapseAll: () => void
  compact?: boolean
}

export function FlowGraphToolbar({
  search,
  onSearchChange,
  onZoomIn,
  onZoomOut,
  onFitView,
  onExpandAll,
  onCollapseAll,
  compact = false,
}: FlowGraphToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border bg-background/95 p-2 shadow-sm backdrop-blur",
        compact && "gap-1.5 p-1.5"
      )}
    >
      <div className="relative min-w-[160px] flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search nodes…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className={cn("h-8 pl-8 text-xs", compact && "h-7")}
        />
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <ToolbarButton title="Zoom in" onClick={onZoomIn}>
          <Plus className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Zoom out" onClick={onZoomOut}>
          <Minus className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Fit screen" onClick={onFitView}>
          <Maximize2 className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Expand all" onClick={onExpandAll}>
          <FolderOpen className="size-3.5" />
          {!compact && <span className="hidden sm:inline">Expand</span>}
        </ToolbarButton>
        <ToolbarButton title="Collapse all" onClick={onCollapseAll}>
          <FolderClosed className="size-3.5" />
          {!compact && <span className="hidden sm:inline">Collapse</span>}
        </ToolbarButton>
      </div>
    </div>
  )
}

function ToolbarButton({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode
  title: string
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 gap-1 px-2 text-xs"
      title={title}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}
