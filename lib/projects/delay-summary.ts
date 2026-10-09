import type { SupabaseClient } from "@supabase/supabase-js"

import { overdueHours } from "@/lib/projects/delay"
import { getMyTasks } from "@/lib/projects/tasks"
import type { Division } from "@/lib/steps"

export type DelaySummaryStatus =
  | "delay"
  | "awaiting_division"
  | "awaiting_approval"
  | "extended"

export type DelaySummaryRow = {
  projectId: string
  projectName: string
  customerName: string | null
  stepCode: string
  stepName: string
  division: Division
  divisionLabel: string
  overdueHours: number
  waitingHours: number
  delayThresholdHours: number
  status: DelaySummaryStatus
  approvedUntil: string | null
  requestedUntil: string | null
  reason: string | null
}

/** Active steps that are Delay, in a delay-response thread, or on approved extension. */
export async function getDelaySummary(
  supabase: SupabaseClient,
  userDivisions: Division[]
): Promise<DelaySummaryRow[]> {
  const tasks = await getMyTasks(supabase, userDivisions)
  const rows: DelaySummaryRow[] = []

  for (const task of tasks) {
    const response = task.delayResponse ?? null
    const approvedUntil = task.approvedUntil ?? null

    let status: DelaySummaryStatus | null = null
    if (response?.status === "awaiting_approval") status = "awaiting_approval"
    else if (response?.status === "awaiting_division") status = "awaiting_division"
    else if (task.isDelayed) status = "delay"
    else if (approvedUntil) status = "extended"
    if (!status) continue

    rows.push({
      projectId: task.projectId,
      projectName: task.projectName,
      customerName: task.customerName,
      stepCode: task.stepCode,
      stepName: task.stepName,
      division: task.division,
      divisionLabel: task.divisionLabel,
      overdueHours: task.isDelayed
        ? overdueHours(task.waitingHours, task.delayThresholdHours)
        : 0,
      waitingHours: task.waitingHours,
      delayThresholdHours: task.delayThresholdHours,
      status,
      approvedUntil,
      requestedUntil: response?.requestedUntil ?? null,
      reason: response?.reason ?? null,
    })
  }

  return rows
}
