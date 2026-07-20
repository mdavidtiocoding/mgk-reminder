import Link from "next/link"

import { MarkDoneDialog } from "@/components/project/mark-done-dialog"
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
import { cn } from "@/lib/utils"

type TaskCardProps = {
  task: MyTask
}

export function TaskCard({ task }: TaskCardProps) {
  const hasSubsteps = task.substeps.length > 0

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
        <div className="flex flex-wrap gap-2">
          {!hasSubsteps && task.canComplete && (
            <MarkDoneDialog
              projectId={task.projectId}
              stepCode={task.stepCode}
              stepName={task.stepName}
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
