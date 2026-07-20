"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, Lock } from "lucide-react"

import { MarkDoneDialog } from "@/components/project/mark-done-dialog"
import { SetFollowUpDialog } from "@/components/project/set-followup-dialog"
import { SubstepActions } from "@/components/project/substep-actions"
import { JUMP_TO_STAGE_EVENT } from "@/components/project/stage-progress-bar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDateTime, formatFollowUpSchedule } from "@/lib/format"
import type { ProjectDetail, StepTimelineItem } from "@/lib/projects/detail"
import { DIVISION_BADGE_STYLES, STAGE_LABELS, TOTAL_STAGE_COUNT } from "@/lib/steps"
import { cn } from "@/lib/utils"

type StepTimelineProps = {
  project: ProjectDetail
}

type StageGroup = {
  stage: number
  label: string
  steps: StepTimelineItem[]
  doneCount: number
  totalCount: number
  hasActive: boolean
  isAllDone: boolean
}

function groupStepsByStage(steps: StepTimelineItem[]): StageGroup[] {
  const byStage = new Map<number, StepTimelineItem[]>()
  for (const step of steps) {
    const list = byStage.get(step.stage) ?? []
    list.push(step)
    byStage.set(step.stage, list)
  }

  return Array.from(byStage.entries())
    .sort(([a], [b]) => a - b)
    .map(([stage, stageSteps]) => {
      const doneCount = stageSteps.filter((s) => s.status === "done").length
      return {
        stage,
        label: STAGE_LABELS[stage] ?? `Tahap ${stage}`,
        steps: stageSteps,
        doneCount,
        totalCount: stageSteps.length,
        hasActive: stageSteps.some((s) => s.status === "active"),
        isAllDone: doneCount === stageSteps.length,
      }
    })
}

export function StepTimeline({ project }: StepTimelineProps) {
  const stages = useMemo(() => groupStepsByStage(project.steps), [project.steps])

  const firstActiveStage = useMemo(() => {
    const active = project.steps.find((s) => s.status === "active")
    return active?.stage ?? 1
  }, [project.steps])

  const [currentStage, setCurrentStage] = useState(firstActiveStage)
  const [direction, setDirection] = useState<"left" | "right" | null>(null)
  const [animating, setAnimating] = useState(false)
  const pendingStage = useRef<number | null>(null)

  function goToStage(stage: number) {
    const clamped = Math.max(1, Math.min(TOTAL_STAGE_COUNT, stage))
    if (clamped === currentStage || animating) return
    const dir = clamped > currentStage ? "left" : "right"
    pendingStage.current = clamped
    setDirection(dir)
    setAnimating(true)
  }

  useEffect(() => {
    if (!animating) return
    const timer = setTimeout(() => {
      if (pendingStage.current !== null) {
        setCurrentStage(pendingStage.current)
        pendingStage.current = null
      }
      setDirection(null)
      setAnimating(false)
    }, 220)
    return () => clearTimeout(timer)
  }, [animating])

  useEffect(() => {
    function onJump(event: Event) {
      const detail = (event as CustomEvent<{ stage: number }>).detail
      if (!detail?.stage) return
      goToStage(detail.stage)
    }
    window.addEventListener(JUMP_TO_STAGE_EVENT, onJump)
    return () => window.removeEventListener(JUMP_TO_STAGE_EVENT, onJump)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStage, animating])

  const group = stages.find((g) => g.stage === currentStage) ?? stages[0]
  const canPrev = currentStage > 1
  const canNext = currentStage < TOTAL_STAGE_COUNT

  const slideOutClass =
    direction === "left"
      ? "-translate-x-8 opacity-0"
      : direction === "right"
        ? "translate-x-8 opacity-0"
        : ""

  return (
    <div className="flex flex-col gap-4">
      {/* Stage panel */}
      <div className="overflow-hidden rounded-xl border">
        {/* Stage header */}
        <div
          className={cn(
            "flex items-center justify-between gap-3 border-b px-4 py-3",
            group?.hasActive && "bg-primary/5",
            group?.isAllDone && "bg-green-50",
            !group?.hasActive && !group?.isAllDone && "bg-muted/40"
          )}
        >
          <div className="flex items-center gap-2">
            {group?.isAllDone ? (
              <CheckCircle2 className="size-4 shrink-0 text-green-600" />
            ) : group?.hasActive ? (
              <Circle className="size-4 shrink-0 fill-primary/15 text-primary" />
            ) : (
              <Lock className="size-4 shrink-0 text-muted-foreground/50" />
            )}
            <span
              className={cn(
                "text-sm font-semibold",
                group?.isAllDone && "text-green-700",
                !group?.hasActive && !group?.isAllDone && "text-muted-foreground"
              )}
            >
              Tahap {currentStage} — {group?.label}
            </span>
            <span className="text-xs text-muted-foreground">
              {group?.hasActive || group?.isAllDone
                ? `· ${group?.doneCount}/${group?.totalCount} selesai`
                : "· Terkunci"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              disabled={!canPrev}
              onClick={() => goToStage(currentStage - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-xs text-muted-foreground">
              {currentStage}/{TOTAL_STAGE_COUNT}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              disabled={!canNext}
              onClick={() => goToStage(currentStage + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        {/* Steps list with slide animation */}
        <div
          className={cn(
            "transition-all duration-200 ease-in-out",
            animating && direction ? slideOutClass : "translate-x-0 opacity-100"
          )}
        >
          <ol className="flex flex-col gap-0 px-4 pb-4 pt-2">
            {(group?.steps ?? []).map((step, index) => {
              const isLast = index === (group?.steps.length ?? 0) - 1

              return (
                <li key={step.code} className="relative flex gap-4 pb-8 last:pb-0">
                  {!isLast && (
                    <span
                      className={cn(
                        "absolute top-8 left-3.5 w-px -translate-x-1/2",
                        step.status === "done" ? "bg-primary/40" : "bg-border"
                      )}
                      style={{ height: "calc(100% - 2rem)" }}
                      aria-hidden
                    />
                  )}

                  <div className="relative z-10 mt-0.5 shrink-0">
                    {step.status === "done" && (
                      <CheckCircle2 className="size-7 text-primary" aria-hidden />
                    )}
                    {step.status === "active" && (
                      <Circle className="size-7 fill-primary/15 text-primary" aria-hidden />
                    )}
                    {step.status === "locked" && (
                      <Lock className="size-7 text-muted-foreground/50" aria-hidden />
                    )}
                  </div>

                  <div
                    className={cn(
                      "min-w-0 flex-1 rounded-xl border border-l-4 p-4",
                      DIVISION_BADGE_STYLES[step.division].border,
                      step.status === "active" && "border-primary/40 bg-primary/5",
                      step.status === "locked" && "opacity-60"
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">
                          Step {step.code} · Tahap {step.stage}
                        </p>
                        <p className="mt-0.5 font-medium leading-snug">{step.name}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            DIVISION_BADGE_STYLES[step.division].badge
                          )}
                        >
                          {step.divisionLabel}
                        </span>
                        {step.status === "active" && (
                          <Badge variant="default">Aktif</Badge>
                        )}
                      </div>
                    </div>

                    {step.status === "done" && (
                      <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                        {step.completedByName && (
                          <p>
                            Selesai oleh:{" "}
                            <span className="text-foreground">{step.completedByName}</span>
                          </p>
                        )}
                        {step.completedAt && (
                          <p>{formatDateTime(step.completedAt)}</p>
                        )}
                        {step.outcome && (
                          <p>
                            Hasil:{" "}
                            <span className="text-foreground">
                              {step.outcome === "reschedule" ? "Perlu Reschedule" : "OK"}
                            </span>
                          </p>
                        )}
                        {step.note && (
                          <p className="italic">&ldquo;{step.note}&rdquo;</p>
                        )}
                      </div>
                    )}

                    {step.status === "active" && (
                      <div className="mt-3 space-y-3">
                        <p className="text-sm text-muted-foreground">
                          PIC:{" "}
                          <span className="text-foreground">{step.divisionLabel}</span>
                        </p>
                        {step.substeps.length > 0 && (
                          <SubstepActions
                            projectId={project.id}
                            stepCode={step.code}
                            substeps={step.substeps}
                            completions={step.substepCompletions}
                            canEdit={step.canComplete}
                          />
                        )}
                        {step.checklist && step.checklist.length > 0 && (
                          <p className="text-sm text-muted-foreground">
                            Checklist: {step.checklist.join(", ")}
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground">
                          Reminder terakhir:{" "}
                          {step.lastReminderAt ? (
                            formatDateTime(step.lastReminderAt)
                          ) : (
                            "Belum ada"
                          )}
                        </p>
                        {step.followUpDate && (
                          <p className="text-sm text-primary">
                            Follow-up dijadwalkan:{" "}
                            {formatFollowUpSchedule(
                              step.followUpDate,
                              step.followUpTime ?? "09:00:00"
                            )}
                            {step.followUpNote ? (
                              <span className="block text-muted-foreground italic">
                                &ldquo;{step.followUpNote}&rdquo;
                              </span>
                            ) : null}
                          </p>
                        )}
                        {step.canComplete && step.substeps.length === 0 && (
                          <div className="flex flex-wrap gap-2">
                            <MarkDoneDialog
                              projectId={project.id}
                              stepCode={step.code}
                              stepName={step.name}
                              checklist={step.checklist}
                              dateInputs={step.dateInputs}
                              hasOutcome={step.hasOutcome}
                            />
                            <SetFollowUpDialog
                              projectId={project.id}
                              stepCode={step.code}
                              stepName={step.name}
                              existingDate={step.followUpDate}
                              existingTime={step.followUpTime}
                              existingNote={step.followUpNote}
                            />
                          </div>
                        )}
                        {step.canComplete && step.substeps.length > 0 && (
                          <SetFollowUpDialog
                            projectId={project.id}
                            stepCode={step.code}
                            stepName={step.name}
                            existingDate={step.followUpDate}
                            existingTime={step.followUpTime}
                            existingNote={step.followUpNote}
                          />
                        )}
                      </div>
                    )}

                    {step.status === "locked" && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {step.prerequisites.length > 0
                          ? `Menunggu: ${step.prerequisites.join(", ")}`
                          : "Terkunci"}
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </div>
  )
}
