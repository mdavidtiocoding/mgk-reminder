import type { SupabaseClient } from "@supabase/supabase-js"

import { getAppThresholds } from "@/lib/app-config"
import { daysSinceWib, isFollowUpReminderDue, todayDateKeyWib } from "@/lib/format"
import {
  computeProjectSteps,
  getActiveComputedSteps,
  getDefaultRepeatDays,
  type CompletionInfo,
} from "@/lib/projects/active-steps"
import { loadRuntimeSteps } from "@/lib/steps/runtime-config"
import { loadSubstepCompletionsMap } from "@/lib/projects/substep-data"

import { notifyAdminsHogger, notifyDivisionForStep } from "./send"

type ProjectRow = {
  id: string
  name: string
  status: string
  created_at: string
  ex_work_date: string | null
  etd_date: string | null
  eta_date: string | null
  mos_date: string | null
  step_completions: { step_code: string; completed_at: string }[]
}

type ReminderConfigRow = {
  step_code: string
  enabled: boolean
  repeat_days: number | null
  max_repeats: number | null
}

function daysSince(date: Date): number {
  return daysSinceWib(date)
}

const ACTIVE_PROJECT_SELECT = `
  id, name, status, created_at, ex_work_date, etd_date, eta_date, mos_date,
  step_completions(step_code, completed_at)
`

/** Daily hogger sweep — flags active steps stuck too long, notifies admins. */
export async function runDailyReminders(supabase: SupabaseClient) {
  const [{ data: projects }, thresholds, runtimeSteps] = await Promise.all([
    supabase.from("projects").select(ACTIVE_PROJECT_SELECT).eq("status", "active"),
    getAppThresholds(supabase),
    loadRuntimeSteps(supabase),
  ])

  let hoggerAlerts = 0
  const substepMap = await loadSubstepCompletionsMap(
    supabase,
    ((projects ?? []) as ProjectRow[]).map((project) => project.id)
  )

  for (const project of (projects ?? []) as ProjectRow[]) {
    const completions: CompletionInfo[] = (project.step_completions ?? []).map((c) => ({
      stepCode: c.step_code,
      completedAt: c.completed_at,
    }))

    const substepCompletions = substepMap.get(project.id) ?? []

    const computedSteps = computeProjectSteps(completions, {
      createdAt: project.created_at,
      ex_work_date: project.ex_work_date,
      etd_date: project.etd_date,
      eta_date: project.eta_date,
      mos_date: project.mos_date,
    }, {
      steps: runtimeSteps,
      substepCompletions,
    })

    for (const active of getActiveComputedSteps(computedSteps)) {
      const waitingDays = active.unlockedAt ? daysSince(active.unlockedAt) : 0
      if (waitingDays <= thresholds.hoggerDays) continue

      const { data: logs } = await supabase
        .from("reminder_log")
        .select("sent_at")
        .eq("project_id", project.id)
        .eq("step_code", active.definition.code)
        .eq("channel", "hogger")

      const hoggerToday = (logs ?? []).some(
        (l) => daysSince(new Date(l.sent_at)) === 0
      )
      if (hoggerToday) continue

      await notifyAdminsHogger({
        projectId: project.id,
        projectName: project.name,
        stepCode: active.definition.code,
      })
      hoggerAlerts++
    }
  }

  return { projectsChecked: projects?.length ?? 0, hoggerAlerts }
}

/**
 * Step-level reminders — runs every ~2 hours (see vercel.json; Vercel Hobby
 * only allows once-per-day per cron entry, so we stack several daily entries
 * at different hours to approximate a frequent check). Sends the first
 * notification once a step's trigger date is reached (immediate / after_step
 * / before_date / after_date), then repeats per reminder_config.repeat_days
 * (falling back to the step's own default repeat, if any) up to max_repeats.
 */
export async function runStepReminders(supabase: SupabaseClient) {
  const [{ data: projects }, runtimeSteps] = await Promise.all([
    supabase.from("projects").select(ACTIVE_PROJECT_SELECT).eq("status", "active"),
    loadRuntimeSteps(supabase),
  ])

  const { data: configs } = await supabase.from("reminder_config").select("*")
  const configMap = new Map<string, ReminderConfigRow>(
    (configs ?? []).map((c) => [c.step_code as string, c as ReminderConfigRow])
  )

  let remindersSent = 0
  const now = Date.now()
  const substepMap = await loadSubstepCompletionsMap(
    supabase,
    ((projects ?? []) as ProjectRow[]).map((project) => project.id)
  )

  for (const project of (projects ?? []) as ProjectRow[]) {
    const completions: CompletionInfo[] = (project.step_completions ?? []).map((c) => ({
      stepCode: c.step_code,
      completedAt: c.completed_at,
    }))

    const substepCompletions = substepMap.get(project.id) ?? []

    const computedSteps = computeProjectSteps(completions, {
      createdAt: project.created_at,
      ex_work_date: project.ex_work_date,
      etd_date: project.etd_date,
      eta_date: project.eta_date,
      mos_date: project.mos_date,
    }, {
      steps: runtimeSteps,
      substepCompletions,
    })

    for (const active of getActiveComputedSteps(computedSteps)) {
      const config = configMap.get(active.definition.code)
      if (config?.enabled === false) continue
      if (!active.triggerAt || now < active.triggerAt.getTime()) continue

      const { data: logs } = await supabase
        .from("reminder_log")
        .select("sent_at, channel")
        .eq("project_id", project.id)
        .eq("step_code", active.definition.code)
        .neq("channel", "hogger")
        .order("sent_at", { ascending: false })

      const sentCount = logs?.length ?? 0
      const lastSentAt = logs?.[0]?.sent_at
      const repeatDays = config?.repeat_days ?? getDefaultRepeatDays(active.definition)
      const maxRepeats = config?.max_repeats

      let shouldSend = false
      if (sentCount === 0) {
        shouldSend = true
      } else if (repeatDays && (maxRepeats == null || sentCount < maxRepeats)) {
        const daysSinceLast = lastSentAt ? daysSince(new Date(lastSentAt)) : Infinity
        shouldSend = daysSinceLast >= repeatDays
      }

      if (!shouldSend) continue

      await notifyDivisionForStep({
        projectId: project.id,
        projectName: project.name,
        stepCode: active.definition.code,
        type: sentCount === 0 ? "step_unlock" : "reminder",
      })
      remindersSent++
    }
  }

  return { remindersSent }
}

type FollowUpScheduleRow = {
  id: string
  project_id: string
  step_code: string
  scheduled_date: string
  scheduled_time: string
  note: string | null
  projects: { name: string; status: string } | { name: string; status: string }[]
}

function normalizeProject(
  value: FollowUpScheduleRow["projects"]
): { name: string; status: string } | null {
  if (!value) return null
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

export async function runFollowUpReminders(supabase: SupabaseClient) {
  const today = todayDateKeyWib()

  const { data: schedules } = await supabase
    .from("followup_schedule")
    .select(
      `
      id,
      project_id,
      step_code,
      scheduled_date,
      scheduled_time,
      note,
      projects!inner(name, status)
    `
    )
    .lte("scheduled_date", today)
    .is("notified_at", null)

  let followUpsSent = 0

  for (const row of schedules ?? []) {
    const typed = row as FollowUpScheduleRow
    const project = normalizeProject(typed.projects)
    if (!project || project.status !== "active") continue

    const scheduledTime = typed.scheduled_time ?? "09:00:00"
    if (!isFollowUpReminderDue(typed.scheduled_date, scheduledTime, 30)) continue

    await notifyDivisionForStep({
      projectId: typed.project_id,
      projectName: project.name,
      stepCode: typed.step_code,
      type: "followup",
      scheduledDate: typed.scheduled_date,
      scheduledTime,
      followUpNote: typed.note,
    })

    await supabase
      .from("followup_schedule")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", typed.id)

    followUpsSent++
  }

  return { followUpsSent }
}
