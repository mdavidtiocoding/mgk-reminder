"use client"

import { STAGE_LABELS, TOTAL_STAGE_COUNT, type ProjectStatus } from "@/lib/steps"
import { cn } from "@/lib/utils"

export const JUMP_TO_STAGE_EVENT = "mgk:jump-to-stage"

type StageProgressBarProps = {
  currentStage: number
  doneCount: number
  totalCount: number
  status: ProjectStatus
}

export function StageProgressBar({
  currentStage,
  doneCount,
  totalCount,
  status,
}: StageProgressBarProps) {
  const isCompleted = status === "completed"

  function jumpToStage(stage: number) {
    window.dispatchEvent(
      new CustomEvent(JUMP_TO_STAGE_EVENT, { detail: { stage } })
    )
  }

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex flex-col gap-0.5">
        <p className="text-base font-semibold">
          Tahap {currentStage} / {TOTAL_STAGE_COUNT} — {STAGE_LABELS[currentStage]}
        </p>
        <p className="text-sm text-muted-foreground">
          {doneCount} / {totalCount} step selesai
        </p>
      </div>

      <div className="flex items-start">
        {Array.from({ length: TOTAL_STAGE_COUNT }, (_, index) => {
          const stage = index + 1
          const isFilled = isCompleted || stage < currentStage
          const isCurrent = !isCompleted && stage === currentStage
          const isFuture = !isFilled && !isCurrent
          const isLast = stage === TOTAL_STAGE_COUNT

          return (
            <div key={stage} className="flex flex-1 items-start">
              <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => jumpToStage(stage)}
                  title={`Loncat ke Tahap ${stage} — ${STAGE_LABELS[stage]}`}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                    "cursor-pointer hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isFilled &&
                      "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
                    isCurrent &&
                      "border-primary bg-primary/15 text-primary ring-4 ring-primary/20",
                    isFuture &&
                      "border-muted-foreground/25 bg-muted text-muted-foreground hover:border-muted-foreground/50"
                  )}
                >
                  {stage}
                </button>
                <button
                  type="button"
                  onClick={() => jumpToStage(stage)}
                  className={cn(
                    "max-w-[5.5rem] text-center text-[10px] leading-tight hover:underline",
                    isCurrent && "font-semibold text-primary",
                    isFilled && !isCurrent && "text-foreground",
                    isFuture && "text-muted-foreground"
                  )}
                >
                  {STAGE_LABELS[stage]}
                </button>
              </div>

              {!isLast && (
                <div
                  className={cn(
                    "mt-4 h-0.5 min-w-2 flex-1 rounded-full",
                    isFilled ? "bg-primary" : "bg-muted"
                  )}
                  aria-hidden
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
