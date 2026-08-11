"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown, ChevronUp } from "lucide-react"

import {
  DivisionBadge,
  ProjectStatusBadge,
} from "@/components/ui/status-badges"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { DIVISION_BADGE_STYLES, STAGE_SHORT_LABELS } from "@/lib/steps"
import type { DashboardProject } from "@/lib/projects/dashboard"
import { cn } from "@/lib/utils"

type ProjectCardProps = {
  project: DashboardProject
  variant?: "classic" | "premium"
}

function resolveBorderClass(project: DashboardProject): string {
  if (project.activeSteps.length === 0) return "border-l-4 border-l-border"
  const divisions = new Set(project.activeSteps.map((step) => step.division))
  if (divisions.size !== 1) return "border-l-4 border-l-primary"
  return cn(
    "border-l-4",
    DIVISION_BADGE_STYLES[project.activeSteps[0]!.division].border
  )
}

function uniqueActiveDivisions(project: DashboardProject) {
  const seen = new Set<string>()
  const result: { division: DashboardProject["activeSteps"][number]["division"]; label: string }[] =
    []
  for (const step of project.activeSteps) {
    if (seen.has(step.division)) continue
    seen.add(step.division)
    result.push({ division: step.division, label: step.divisionLabel })
  }
  return result
}

export function ProjectCard({ project, variant = "classic" }: ProjectCardProps) {
  const [expanded, setExpanded] = useState(false)
  const isOnHold = project.status === "on_hold"
  const divisionBadges = uniqueActiveDivisions(project)
  const pendingCount = project.activeSteps.length
  const showDelay = project.status === "active" && project.maxWaitingDays > 0

  const summary = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <ProjectStatusBadge
              status={project.status}
              isHogger={project.isHogger}
              delayDays={showDelay ? project.maxWaitingDays : 0}
              isWaitingWarning={project.isWaitingWarning}
            />
            {project.status === "active" &&
              divisionBadges.map((item) => (
                <DivisionBadge
                  key={item.division}
                  division={item.division}
                  label={item.label}
                />
              ))}
          </div>
          <CardTitle className={cn("text-base leading-snug", isOnHold && "text-muted-foreground")}>
            {project.name}
          </CardTitle>
          <CardDescription className="mt-0.5 truncate">
            {project.customerName ?? "Tanpa customer"} ·{" "}
            {STAGE_SHORT_LABELS[project.currentStage] ?? `T${project.currentStage}`}
          </CardDescription>
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span className="truncate">
            {project.currentStageLabel}
          </span>
          <span className="shrink-0 tabular-nums">
            {project.doneCount}/{project.totalCount}
          </span>
        </div>
        <Progress value={project.stepProgress} className="h-2" />
      </div>
    </>
  )

  const details = (
    <div className="mt-3 space-y-2 border-t pt-3">
      {project.activeSteps.length === 0 ? (
        <p className="text-sm text-muted-foreground">Tidak ada step aktif</p>
      ) : (
        project.activeSteps.map((step) => (
          <div key={step.code} className="flex items-start justify-between gap-2">
            <p className="min-w-0 text-sm leading-snug">
              <span className="font-medium">{step.code}</span>
              <span className="text-muted-foreground"> — {step.name}</span>
            </p>
            <DivisionBadge division={step.division} label={step.divisionLabel} />
          </div>
        ))
      )}
    </div>
  )

  if (variant === "premium") {
    return (
      <Card
        className={cn(
          "overflow-hidden border shadow-none transition-all duration-150 hover:border-primary/30 hover:shadow-sm",
          resolveBorderClass(project),
          isOnHold && "opacity-75"
        )}
      >
        <CardHeader className="pb-2">
          <Link href={`/projects/${project.id}`} className="block min-w-0">
            {summary}
          </Link>
        </CardHeader>
        <CardContent className="pt-0">
          {expanded && details}
          <button
            type="button"
            className="mt-2 flex w-full items-center justify-center gap-1 py-1.5 text-xs font-medium text-primary"
            onClick={(e) => {
              e.preventDefault()
              setExpanded((v) => !v)
            }}
          >
            {expanded ? (
              <>
                Sembunyikan <ChevronUp className="size-3.5" />
              </>
            ) : (
              <>
                {pendingCount > 0
                  ? `Lihat ${pendingCount} step aktif`
                  : "Lihat detail"}{" "}
                <ChevronDown className="size-3.5" />
              </>
            )}
          </button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      className={cn(
        "transition-colors hover:bg-muted/20",
        isOnHold && "border-muted bg-muted/40 opacity-75"
      )}
    >
      <CardHeader className="pb-2">
        <Link href={`/projects/${project.id}`} className="block min-w-0">
          {summary}
        </Link>
      </CardHeader>
      <CardContent className="pt-0">
        {expanded && details}
        <button
          type="button"
          className="mt-2 flex w-full items-center justify-center gap-1 py-1.5 text-xs font-medium text-primary"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <>
              Sembunyikan <ChevronUp className="size-3.5" />
            </>
          ) : (
            <>
              {pendingCount > 0
                ? `Lihat ${pendingCount} step aktif`
                : "Lihat detail"}{" "}
              <ChevronDown className="size-3.5" />
            </>
          )}
        </button>
      </CardContent>
    </Card>
  )
}
