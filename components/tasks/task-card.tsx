import Link from "next/link"

import { MarkDoneDialog } from "@/components/project/mark-done-dialog"
import { StepChecklistCompletion } from "@/components/project/step-checklist-completion"
import { StepRescheduleNotice } from "@/components/project/step-reschedule-notice"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { MyTask } from "@/lib/projects/tasks"
import { usesInlineChecklist } from "@/lib/steps/inline-checklist"
import { cn } from "@/lib/utils"

type TaskCardProps = {
  task: MyTask
}

export function TaskCard({ task }: TaskCardProps) {
  const hasSubsteps = task.substeps.length > 0
  const inlineChecklist = usesInlineChecklist({
    completionMode: task.completionMode,
    checklist: task.checklist,
    hasOutcome: task.hasOutcome,
    dateInputs: task.dateInputs,
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate">
              <Link
                href={`/projects/${task.projectId}`}
                className="hover:underline"
              >
                {task.projectName}
              </Link>
            </CardTitle>
            <CardDescription className="truncate">
              {task.customerName ?? "Tanpa customer"} · Step {task.stepCode}
            </CardDescription>
          </div>
          {task.isHogger && <Badge variant="destructive">HOGGER</Badge>}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm leading-snug">{task.stepName}</p>
        <p className="text-xs text-muted-foreground">PIC: {task.divisionLabel}</p>
        {task.lastRescheduleDate && (
          <StepRescheduleNotice
            rescheduleDate={task.lastRescheduleDate}
            rescheduledAt={task.lastRescheduleAt}
            className="text-xs"
          />
        )}
        <p
          className={cn(
            "text-xs",
            task.isWaitingWarning
              ? "font-medium text-destructive"
              : "text-muted-foreground"
          )}
        >
          Delay {task.waitingDays} hari
        </p>
        {hasSubsteps && task.nextSubstepLabel && (
          <p className="text-xs text-muted-foreground">
            Sub-step berikutnya:{" "}
            <span className="text-foreground">{task.nextSubstepLabel}</span>
            {" · "}
            tindakan di halaman detail project
          </p>
        )}
        {inlineChecklist && !hasSubsteps && task.canComplete && task.checklist && (
          <StepChecklistCompletion
            projectId={task.projectId}
            stepCode={task.stepCode}
            checklist={task.checklist}
            completionMode={task.completionMode}
            compact
          />
        )}
        <div className="flex flex-wrap gap-2">
          {!hasSubsteps && task.canComplete && !inlineChecklist && (
            <MarkDoneDialog
              projectId={task.projectId}
              stepCode={task.stepCode}
              stepName={task.stepName}
              completionMode={task.completionMode}
              checklist={task.checklist}
              dateInputs={task.dateInputs}
              hasOutcome={task.hasOutcome}
            />
          )}
          <Button variant={hasSubsteps ? "default" : "outline"} size="sm" asChild>
            <Link href={`/projects/${task.projectId}`}>
              {hasSubsteps ? "Buka & selesaikan" : "Detail"}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
