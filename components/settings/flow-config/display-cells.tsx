"use client"

import { ChevronDown, Layers } from "lucide-react"
import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { StepDefinition } from "@/lib/steps"
import { getTriggerBadges, describeTriggerFull } from "@/lib/steps/trigger-display"
import type { SubstepDefinition } from "@/lib/steps/substeps"
import { getSubstepChecklist, getSubstepKind, SUBSTEP_KIND_LABELS } from "@/lib/steps/substeps"
import { cn } from "@/lib/utils"

type NameLookup = Map<string, string>

function stepLabel(code: string, names: NameLookup): string {
  const name = names.get(code)
  return name ? `${code} — ${name}` : code
}

export function DependencyDisplay({
  codes,
  names,
  maxVisible = 2,
}: {
  codes: string[]
  names: NameLookup
  maxVisible?: number
}) {
  const [expanded, setExpanded] = useState(false)

  if (codes.length === 0) {
    return <span className="text-muted-foreground">—</span>
  }

  if (codes.length <= maxVisible || expanded) {
    return (
      <div className="flex flex-col gap-1">
        {codes.map((code) => (
          <span
            key={code}
            className="text-xs leading-snug"
            title={stepLabel(code, names)}
          >
            <span className="font-mono font-semibold">{code}</span>
            {names.get(code) && (
              <span className="text-muted-foreground"> — {names.get(code)}</span>
            )}
          </span>
        ))}
        {expanded && codes.length > maxVisible && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-fit px-1 text-xs"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(false)
            }}
          >
            Tutup
          </Button>
        )}
      </div>
    )
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-auto gap-1 px-1 py-0.5 text-xs"
      onClick={(e) => {
        e.stopPropagation()
        setExpanded(true)
      }}
    >
      <span>🔗 {codes.length} prasyarat</span>
      <ChevronDown className="size-3" />
    </Button>
  )
}

export function UnlockDisplay({
  codes,
  names,
}: {
  codes: string[]
  names: NameLookup
}) {
  if (codes.length === 0) {
    return <span className="text-muted-foreground">—</span>
  }

  return (
    <div className="flex flex-wrap gap-1">
      {codes.map((code) => (
        <Badge
          key={code}
          variant="secondary"
          className="font-mono text-[10px]"
          title={stepLabel(code, names)}
        >
          {code} →
        </Badge>
      ))}
    </div>
  )
}

export function SubstepDisplay({ substeps }: { substeps: SubstepDefinition[] }) {
  const [expanded, setExpanded] = useState(false)

  if (substeps.length === 0) {
    return <span className="text-muted-foreground">—</span>
  }

  if (!expanded) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-auto gap-1 px-1 py-0.5 text-xs"
        onClick={(e) => {
          e.stopPropagation()
          setExpanded(true)
        }}
      >
        <Layers className="size-3" aria-hidden />
        {substeps.length} sub-step
        <ChevronDown className="size-3" />
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-0.5">
      {substeps.map((s, i) => {
        const checklist = getSubstepChecklist(s)
        return (
          <span key={s.key} className="text-xs">
            {i + 1}. {s.label}
            {getSubstepKind(s) === "reminder" && (
              <span className="ml-1 text-muted-foreground">
                ({SUBSTEP_KIND_LABELS.reminder})
              </span>
            )}
            {checklist.length > 0 && (
              <span className="ml-1 text-muted-foreground">
                · {checklist.length} checklist
              </span>
            )}
          </span>
        )
      })}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 w-fit px-1 text-xs"
        onClick={(e) => {
          e.stopPropagation()
          setExpanded(false)
        }}
      >
        Tutup
      </Button>
    </div>
  )
}

export function TriggerDisplay({ stepDef }: { stepDef?: StepDefinition }) {
  if (!stepDef) {
    return <span className="text-muted-foreground">—</span>
  }

  const badges = getTriggerBadges(stepDef.trigger)
  const full = describeTriggerFull(stepDef)

  return (
    <div className="flex flex-wrap gap-1" title={full}>
      {badges.map((badge, i) => (
        <span
          key={`${badge.label}-${i}`}
          className={cn(
            "inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
            badge.variant === "repeat" && "border-violet-200 bg-violet-50 text-violet-800",
            badge.variant === "muted" && "bg-muted text-muted-foreground",
            !badge.variant && "bg-background"
          )}
        >
          <span>{badge.icon}</span>
          {badge.label}
        </span>
      ))}
    </div>
  )
}

export function buildNameLookup(
  options: { code: string; name: string }[]
): NameLookup {
  return new Map(options.map((o) => [o.code, o.name]))
}
