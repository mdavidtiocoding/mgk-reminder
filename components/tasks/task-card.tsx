import Link from "next/link"

import { IncomingStepNotes } from "@/components/project/incoming-step-notes"
import { MarkDoneDialog } from "@/components/project/mark-done-dialog"
import { SetFollowUpDialog } from "@/components/project/set-followup-dialog"
import { StepChecklistCompletion } from "@/components/project/step-checklist-completion"
import { StepRescheduleNotice } from "@/components/project/step-reschedule-notice"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DivisionBadge,
  ProjectStatusBadge,
} from "@/components/ui/status-badges"
import type { MyTask } from "@/lib/projects/tasks"
import { formatDelayDuration } from "@/lib/projects/delay"
import { usesInlineChecklist } from "@/lib/steps/inline-checklist"

type TaskCardProps = {
  task: MyTask
}

export function TaskCard({ task }: TaskCardProps) {
  const hasSubsteps = task.substeps.length > 0
  const projectStepHref = `/projects/${task.projectId}?step=${encodeURIComponent(task.stepCode)}#step-${task.stepCode}`
  const inlineChecklist = usesInlineChecklist({
    completionMode: task.completionMode,
    checklist: task.checklist,
    hasOutcome: task.hasOutcome,
    dateInputs: task.dateInputs,
    noteRoute: (task.noteRouteTargets?.length ?? 0) > 0,
  })

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <ProjectStatusBadge
            status="active"
            isHogger={task.isHogger}
            isDelayed={task.isDelayed}
            delayLabel={
              task.isDelayed
                ? `Delay ${formatDelayDuration(task.waitingHours)}`
                : undefined
            }
            isWaitingWarning={task.isWaitingWarning}
          />
          <DivisionBadge
            division={task.division}
            label={task.divisionLabel}
          />
        </div>
        <CardTitle className="truncate text-base">
          <Link href={projectStepHref} className="hover:underline">
            {task.projectName}
          </Link>
        </CardTitle>
        <CardDescription className="truncate">
          {task.customerName ?? "Tanpa customer"} · {task.stepCode}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm leading-snug">{task.stepName}</p>
        {(task.incomingNotes?.length ?? 0) > 0 && (
          <IncomingStepNotes notes={task.incomingNotes ?? []} compact />
        )}
        {task.lastRescheduleDate && (
          <StepRescheduleNotice
            rescheduleDate={task.lastRescheduleDate}
            rescheduledAt={task.lastRescheduleAt}
            className="text-xs"
          />
        )}
        {hasSubsteps && task.nextSubstepLabel && (
          <p className="text-xs text-muted-foreground">
            Sub-step berikutnya:{" "}
            <span className="text-foreground">{task.nextSubstepLabel}</span>
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
        {!task.canComplete && task.canFollowUp && (
          <p className="text-xs text-muted-foreground">
            Preview & follow up — tim {task.divisionLabel} yang mengerjakan.
          </p>
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
              outcomeRescheduleField={task.outcomeRescheduleField}
              bastChoice={task.bastChoice}
              noteRouteTargets={task.noteRouteTargets}
            />
          )}
          {!task.canComplete && task.canFollowUp && (
            <SetFollowUpDialog
              projectId={task.projectId}
              stepCode={task.stepCode}
              stepName={task.stepName}
            />
          )}
          <Button
            variant={task.canComplete && hasSubsteps ? "default" : "outline"}
            size="sm"
            asChild
          >
            <Link href={projectStepHref}>
              {task.canComplete
                ? hasSubsteps
                  ? "Buka & selesaikan"
                  : "Ke step ini"
                : "Preview"}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
