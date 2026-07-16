"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowDownToLine, CheckCircle2, ChevronDown, Circle, Lock } from "lucide-react"

import { MarkDoneDialog } from "@/components/project/mark-done-dialog"
import { SetFollowUpDialog } from "@/components/project/set-followup-dialog"
import { JUMP_TO_STAGE_EVENT } from "@/components/project/stage-progress-bar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDateTime, formatFollowUpSchedule } from "@/lib/format"
import type { ProjectDetail, StepTimelineItem } from "@/lib/projects/detail"
import { DIVISION_BADGE_STYLES, STAGE_LABELS } from "@/lib/steps"
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
        label: STAGE_LABELS[stage] ?? `Stage ${stage}`,
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
  const firstActiveStep = useMemo(
    () => project.steps.find((s) => s.status === "active"),
    [project.steps]
  )

  // Only user-toggled stages are stored here; everything else falls back to
  // "expanded while it has an active step" so the timeline stays in sync as
  // steps get completed on the server.
  const [overrides, setOverrides] = useState<Record<number, boolean>>({})
  const stepRefs = useRef(new Map<string, HTMLLIElement>())
  const stageRefs = useRef(new Map<number, HTMLDivElement>())

  function toggleStage(stage: number, isExpanded: boolean) {
    setOverrides((prev) => ({ ...prev, [stage]: !isExpanded }))
  }

  function jumpToStage(stage: number) {
    setOverrides((prev) => ({ ...prev, [stage]: true }))
    setTimeout(() => {
      stageRefs.current.get(stage)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    }, 60)
  }

  function jumpToActive() {
    if (!firstActiveStep) return
    jumpToStage(firstActiveStep.stage)
    setTimeout(() => {
      stepRefs.current.get(firstActiveStep.code)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      })
    }, 80)
  }

  useEffect(() => {
    function onJump(event: Event) {
      const detail = (event as CustomEvent<{ stage: number }>).detail
      if (!detail?.stage) return
      jumpToStage(detail.stage)
    }
    window.addEventListener(JUMP_TO_STAGE_EVENT, onJump)
    return () => window.removeEventListener(JUMP_TO_STAGE_EVENT, onJump)
  }, [])

  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-2 z-20 flex justify-end">
        <Button
          size="sm"
          variant="outline"
          className="bg-background/95 shadow-sm backdrop-blur"
          onClick={jumpToActive}
          disabled={!firstActiveStep}
        >
          <ArrowDownToLine className="size-4" />
          Jump to Active
        </Button>
      </div>

      {stages.map((group) => {
        const isExpanded = overrides[group.stage] ?? group.hasActive

        return (
          <div
            key={group.stage}
            id={`timeline-stage-${group.stage}`}
            ref={(el) => {
              if (el) stageRefs.current.set(group.stage, el)
              else stageRefs.current.delete(group.stage)
            }}
            className={cn(
              "overflow-hidden rounded-xl border transition-colors scroll-mt-4",
              group.hasActive && "border-primary/40",
              group.isAllDone && "border-green-200",
              !group.hasActive && !group.isAllDone && "border-muted"
            )}
          >
            <button
              type="button"
              onClick={() => toggleStage(group.stage, isExpanded)}
              className={cn(
                "flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors",
                group.hasActive && "bg-primary/5 hover:bg-primary/10",
                group.isAllDone && "bg-green-50 hover:bg-green-100/70",
                !group.hasActive &&
                  !group.isAllDone &&
                  "bg-muted/40 hover:bg-muted/60"
              )}
              aria-expanded={isExpanded}
            >
              <div className="flex min-w-0 items-center gap-2">
                {group.isAllDone ? (
                  <CheckCircle2 className="size-4 shrink-0 text-green-600" aria-hidden />
                ) : group.hasActive ? (
                  <Circle className="size-4 shrink-0 fill-primary/15 text-primary" aria-hidden />
                ) : (
                  <Lock className="size-4 shrink-0 text-muted-foreground/50" aria-hidden />
                )}
                <span
                  className={cn(
                    "truncate text-sm font-semibold",
                    group.isAllDone && "text-green-700",
                    !group.hasActive && !group.isAllDone && "text-muted-foreground"
                  )}
                >
                  Stage {group.stage} — {group.label}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-xs",
                    group.isAllDone
                      ? "text-green-700/80"
                      : group.hasActive
                        ? "text-muted-foreground"
                        : "text-muted-foreground/70"
                  )}
                >
                  {group.hasActive || group.isAllDone
                    ? `· ${group.doneCount}/${group.totalCount} selesai`
                    : "· Locked"}
                </span>
              </div>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform",
                  isExpanded && "rotate-180"
                )}
                aria-hidden
              />
            </button>

            {isExpanded && (
              <ol className="flex flex-col gap-0 px-4 pb-4">
                {group.steps.map((step, index) => {
                  const isLast = index === group.steps.length - 1

                  return (
                    <li
                      key={step.code}
                      ref={(el) => {
                        if (el) stepRefs.current.set(step.code, el)
                        else stepRefs.current.delete(step.code)
                      }}
                      className="relative flex gap-4 pb-8 last:pb-0"
                    >
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
                              Step {step.code} · Stage {step.stage}
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
                                <span className="text-foreground">
                                  {step.completedByName}
                                </span>
                              </p>
                            )}
                            {step.completedAt && (
                              <p>{formatDateTime(step.completedAt)}</p>
                            )}
                            {step.outcome && (
                              <p>
                                Hasil:{" "}
                                <span className="text-foreground">
                                  {step.outcome === "reschedule"
                                    ? "Perlu Reschedule"
                                    : "OK"}
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
                              <span className="text-foreground">
                                {step.divisionLabel}
                              </span>
                            </p>
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
                            {step.canComplete && (
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
                          </div>
                        )}

                        {step.status === "locked" && (
                          <p className="mt-2 text-sm text-muted-foreground">
                            {step.prerequisites.length > 0
                              ? `Menunggu: ${step.prerequisites.join(", ")}`
                              : "Locked"}
                          </p>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        )
      })}
    </div>
  )
}
