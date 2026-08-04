"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, Lock } from "lucide-react"

import { JUMP_TO_STAGE_EVENT } from "@/components/project/stage-progress-bar"
import {
  StepConvergenceRow,
  StepTimelineRow,
} from "@/components/project/step-timeline-row"
import { Button } from "@/components/ui/button"
import type { ProjectDetail, StepTimelineItem } from "@/lib/projects/detail"
import { buildTimelineDisplayItems } from "@/lib/projects/timeline-display"
import { STAGE_LABELS, TOTAL_STAGE_COUNT } from "@/lib/steps"
import { cn } from "@/lib/utils"

type StepTimelineProps = {
  project: ProjectDetail
  variant?: "classic" | "premium"
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

export function StepTimeline({ project, variant = "classic" }: StepTimelineProps) {
  const stages = useMemo(() => groupStepsByStage(project.steps), [project.steps])

  const firstActiveStage = useMemo(() => {
    const active = project.steps.find((s) => s.status === "active")
    return active?.stage ?? 1
  }, [project.steps])

  const [currentStage, setCurrentStage] = useState(firstActiveStage)
  const [direction, setDirection] = useState<"left" | "right" | null>(null)
  const [animating, setAnimating] = useState(false)
  const pendingStage = useRef<number | null>(null)
  const didScroll = useRef(false)

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

  useEffect(() => {
    if (didScroll.current) return
    const params = new URLSearchParams(window.location.search)
    const stepCode =
      params.get("step") ??
      (window.location.hash.startsWith("#step-")
        ? window.location.hash.slice("#step-".length)
        : null)
    if (!stepCode) return
    const step = project.steps.find((s) => s.code === stepCode)
    if (!step) return
    didScroll.current = true
    if (step.stage !== currentStage) {
      setCurrentStage(step.stage)
    }
    const timer = window.setTimeout(() => {
      document.getElementById(`step-${stepCode}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      })
    }, 280)
    return () => window.clearTimeout(timer)
  }, [project.steps, currentStage])

  const group = stages.find((g) => g.stage === currentStage) ?? stages[0]
  const displayItems = useMemo(
    () => buildTimelineDisplayItems(group?.steps ?? []),
    [group?.steps]
  )

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
      <div
        className={cn(
          "overflow-hidden rounded-xl border",
          variant === "premium" && "shadow-sm"
        )}
      >
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

        <div
          className={cn(
            "transition-all duration-200 ease-in-out",
            animating && direction ? slideOutClass : "translate-x-0 opacity-100"
          )}
        >
          <ol className="flex flex-col gap-0 px-4 pb-4 pt-2">
            {displayItems.map((item, index) => {
              const isLast = index === displayItems.length - 1
              const key =
                item.kind === "single" ? item.step.code : `conv-${item.target.code}`

              if (item.kind === "convergence") {
                return (
                  <StepConvergenceRow
                    key={key}
                    project={project}
                    target={item.target}
                    prerequisites={item.prerequisites}
                    showConnector={!isLast}
                  />
                )
              }

              return (
                <StepTimelineRow
                  key={key}
                  project={project}
                  step={item.step}
                  showConnector={!isLast}
                />
              )
            })}
          </ol>
        </div>
      </div>
    </div>
  )
}
