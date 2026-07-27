import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { DIVISION_BADGE_STYLES, TOTAL_STAGE_COUNT } from "@/lib/steps"
import type { DashboardProject } from "@/lib/projects/dashboard"
import { cn } from "@/lib/utils"

const STATUS_LABELS: Record<DashboardProject["status"], string> = {
  active: "Aktif",
  completed: "Selesai",
  on_hold: "Ditahan",
}

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

export function ProjectCard({ project, variant = "classic" }: ProjectCardProps) {
  const isOnHold = project.status === "on_hold"

  if (variant === "premium") {
    return (
      <Link href={`/projects/${project.id}`}>
        <Card
          className={cn(
            "border shadow-none transition-all duration-150 hover:border-primary/30 hover:shadow-md",
            resolveBorderClass(project),
            isOnHold && "opacity-75"
          )}
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <CardTitle className={cn("truncate", isOnHold && "text-muted-foreground")}>
                  {project.name}
                </CardTitle>
                <CardDescription className="truncate">
                  {project.customerName ?? "Tanpa customer"} · Tahap{" "}
                  {project.currentStage}/{TOTAL_STAGE_COUNT}
                </CardDescription>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                {project.status === "on_hold" && (
                  <Badge variant="outline">Ditahan</Badge>
                )}
                {project.status === "completed" && (
                  <Badge variant="secondary">{STATUS_LABELS.completed}</Badge>
                )}
                {project.isHogger && <Badge variant="destructive">HOGGER</Badge>}
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="border-t pt-3">
              <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                <span>{project.currentStageLabel}</span>
                <span>
                  {project.doneCount}/{project.totalCount} step
                </span>
              </div>
              <Progress value={project.stepProgress} className="h-2" />
            </div>

            <div className="flex flex-col gap-2 border-t pt-3">
              {project.activeSteps.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tidak ada step aktif</p>
              ) : (
                project.activeSteps.map((step) => (
                  <div
                    key={step.code}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <p className="min-w-0 text-sm font-medium leading-snug">
                      {step.code} — {step.name}
                    </p>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                        DIVISION_BADGE_STYLES[step.division].badge
                      )}
                    >
                      {step.divisionLabel}
                    </span>
                  </div>
                ))
              )}
            </div>

            {project.status === "active" && project.maxWaitingDays > 0 && (
              <p
                className={cn(
                  "border-t pt-3 text-xs",
                  project.isWaitingWarning
                    ? "font-medium text-destructive"
                    : "text-muted-foreground"
                )}
              >
                Delay {project.maxWaitingDays} hari
              </p>
            )}
          </CardContent>
        </Card>
      </Link>
    )
  }

  return (
    <Link href={`/projects/${project.id}`}>
      <Card
        className={cn(
          "transition-colors hover:bg-muted/30",
          isOnHold && "border-muted bg-muted/40 opacity-75"
        )}
      >
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <CardTitle
                className={cn("truncate", isOnHold && "text-muted-foreground")}
              >
                {project.name}
              </CardTitle>
              <CardDescription className="truncate">
                {project.customerName ?? "Tanpa customer"}
              </CardDescription>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
              {project.status === "on_hold" && (
                <Badge variant="outline">Ditahan</Badge>
              )}
              {project.status === "completed" && (
                <Badge variant="secondary">{STATUS_LABELS.completed}</Badge>
              )}
              {project.isHogger && (
                <Badge variant="destructive">HOGGER</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                Tahap {project.currentStage} / {TOTAL_STAGE_COUNT} —{" "}
                {project.currentStageLabel}
              </span>
              <span>
                {project.doneCount} / {project.totalCount} step
              </span>
            </div>
            <Progress value={project.stepProgress} className="h-2" />
          </div>

          <div className="flex flex-col gap-1.5">
            {project.activeSteps.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Tidak ada step aktif
              </p>
            ) : (
              project.activeSteps.map((step) => (
                <div key={step.code} className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium leading-snug">
                    {step.code} — {step.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PIC: {step.divisionLabel}
                  </p>
                </div>
              ))
            )}
          </div>

          {project.status === "active" && project.maxWaitingDays > 0 && (
            <p
              className={cn(
                "text-xs",
                project.isWaitingWarning
                  ? "font-medium text-destructive"
                  : "text-muted-foreground"
              )}
            >
              Delay {project.maxWaitingDays} hari
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
