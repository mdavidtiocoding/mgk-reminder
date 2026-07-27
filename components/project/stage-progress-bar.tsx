"use client"

import { STAGE_LABELS, TOTAL_STAGE_COUNT, type ProjectStatus } from "@/lib/steps"
import { cn } from "@/lib/utils"

export const JUMP_TO_STAGE_EVENT = "mgk:jump-to-stage"

type StageProgressBarProps = {
  currentStage: number
  doneCount: number
  totalCount: number
  status: ProjectStatus
  variant?: "classic" | "premium"
}

export function StageProgressBar({
  currentStage,
  doneCount,
  totalCount,
  status,
  variant = "classic",
}: StageProgressBarProps) {
  const isCompleted = status === "completed"

  function jumpToStage(stage: number) {
    window.dispatchEvent(
      new CustomEvent(JUMP_TO_STAGE_EVENT, { detail: { stage } })
    )
  }

  return (
    <div
      className={cn(
        "rounded-xl p-5",
        variant === "premium" ? "bg-muted/30" : "border bg-card"
      )}
    >
      <div className="mb-4 flex flex-col gap-0.5">
        <p className="text-base font-semibold">
          Tahap {currentStage} / {TOTAL_STAGE_COUNT} — {STAGE_LABELS[currentStage]}
        </p>
        <p className="text-sm text-muted-foreground">
          {doneCount} / {totalCount} step selesai
        </p>
      </div>

      <div className="flex w-full">
        {Array.from({ length: TOTAL_STAGE_COUNT }, (_, index) => {
          const stage = index + 1
          const isFilled = isCompleted || stage < currentStage
          const isCurrent = !isCompleted && stage === currentStage
          const isFuture = !isFilled && !isCurrent
          const isFirst = stage === 1
          const isLast = stage === TOTAL_STAGE_COUNT
          const leftFilled = !isFirst && (isCompleted || stage - 1 < currentStage)
          const rightFilled = !isLast && (isCompleted || stage < currentStage)

          return (
            <div key={stage} className="flex min-w-0 flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <div
                  className={cn(
                    "h-0.5 flex-1",
                    isFirst ? "bg-transparent" : leftFilled ? "bg-primary" : "bg-muted"
                  )}
                  aria-hidden
                />
                <button
                  type="button"
                  onClick={() => jumpToStage(stage)}
                  title={`Loncat ke Tahap ${stage} — ${STAGE_LABELS[stage]}`}
                  className={cn(
                    "mx-1 flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-[background-color,border-color,box-shadow]",
                    "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isFilled &&
                      "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
                    isCurrent &&
                      cn(
                        "border-primary bg-primary/15 text-primary ring-4 ring-primary/20",
                        variant === "premium" && "premium-pulse-ring"
                      ),
                    isFuture &&
                      "border-muted-foreground/25 bg-muted text-muted-foreground hover:border-primary/40 hover:bg-muted/80"
                  )}
                >
                  {stage}
                </button>
                <div
                  className={cn(
                    "h-0.5 flex-1",
                    isLast ? "bg-transparent" : rightFilled ? "bg-primary" : "bg-muted"
                  )}
                  aria-hidden
                />
              </div>
              <button
                type="button"
                onClick={() => jumpToStage(stage)}
                className={cn(
                  "mt-2 max-w-[5rem] px-0.5 text-center text-[10px] leading-tight transition-colors hover:text-primary",
                  isCurrent && "font-semibold text-primary",
                  isFilled && !isCurrent && "text-foreground",
                  isFuture && "text-muted-foreground"
                )}
              >
                {STAGE_LABELS[stage]}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
