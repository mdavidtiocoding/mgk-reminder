import { APP_TIMEZONE } from "@/lib/constants"
import { dateToDateKeyWib, formatDateKey, parseTimeKey, todayDateKeyWib } from "@/lib/format"
import { computeProjectSteps, type CompletionInfo } from "@/lib/projects/active-steps"
import { loadSubstepCompletionsForProject } from "@/lib/projects/substep-data"
import { loadRuntimeSteps } from "@/lib/steps/runtime-config"
import {
  DATE_FIELD_LABELS,
  getDivisionLabel,
  getStep,
  STEPS,
  type DateField,
  type Division,
} from "@/lib/steps"
import { createServiceClient } from "@/lib/supabase/admin"

import { getGoogleOAuthConfig } from "./env"
import { getValidGoogleAccessToken } from "./oauth"

type CalendarUser = {
  id: string
  google_access_token: string
  google_refresh_token: string
}

type CalendarEventInput = {
  title: string
  description: string
  dateKey: string
  timeKey?: string
}

type EventType = "step_unlock" | "followup"

const CALENDAR_REMINDER_OVERRIDES = [
  { method: "popup" as const, minutes: 30 },
  { method: "popup" as const, minutes: 10 },
  { method: "popup" as const, minutes: 0 },
]

function buildEventDateTimes(event: CalendarEventInput): { start: string; end: string } {
  const { hour, minute } = parseTimeKey(event.timeKey ?? "09:00")
  const start = wibDateTimeIso(event.dateKey, hour, minute)
  const endMinute = minute + 30
  const end = wibDateTimeIso(
    event.dateKey,
    hour + Math.floor(endMinute / 60),
    endMinute % 60
  )
  return { start, end }
}

function getStepCodesUsingDateField(dateField: DateField): string[] {
  return STEPS.filter((step) => {
    const trigger = step.trigger
    return (
      (trigger.type === "before_date" || trigger.type === "after_date") &&
      trigger.dateField === dateField
    )
  }).map((step) => step.code)
}

function normalizeRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

function wibDateTimeIso(dateKey: string, hour: number, minute: number): string {
  const [y, m, d] = dateKey.split("-").map(Number)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${y}-${pad(m)}-${pad(d)}T${pad(hour)}:${pad(minute)}:00+07:00`
}

async function getCalendarUsersForDivision(
  division: Division
): Promise<CalendarUser[]> {
  const service = createServiceClient()
  if (!service) return []

  const { data } = await service
    .from("profiles")
    .select("id, google_access_token, google_refresh_token")
    .eq("status", "active")
    .or(`division.eq.${division},divisions.cs.{${division}}`)
    .eq("google_calendar_connected", true)
    .eq("status", "active")
    .not("google_access_token", "is", null)
    .not("google_refresh_token", "is", null)

  return (data ?? []) as CalendarUser[]
}

async function getConnectedCalendarUser(
  userId: string
): Promise<CalendarUser | null> {
  const service = createServiceClient()
  if (!service) return null

  const { data } = await service
    .from("profiles")
    .select("id, google_access_token, google_refresh_token")
    .eq("id", userId)
    .eq("google_calendar_connected", true)
    .eq("status", "active")
    .not("google_access_token", "is", null)
    .not("google_refresh_token", "is", null)
    .maybeSingle()

  return (data as CalendarUser | null) ?? null
}

async function resolveCalendarRecipients(
  division: Division,
  actingUserId?: string
): Promise<CalendarUser[]> {
  const users = await getCalendarUsersForDivision(division)
  const seen = new Set(users.map((user) => user.id))

  if (actingUserId && !seen.has(actingUserId)) {
    const actor = await getConnectedCalendarUser(actingUserId)
    if (actor) {
      users.push(actor)
      seen.add(actor.id)
    }
  }

  return users
}

async function createCalendarEventForUser(
  user: CalendarUser,
  event: CalendarEventInput
): Promise<string | null> {
  try {
    const accessToken = await getValidGoogleAccessToken(user)
    const { start, end } = buildEventDateTimes(event)

    const response = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: event.title,
          description: event.description,
          start: { dateTime: start, timeZone: APP_TIMEZONE },
          end: { dateTime: end, timeZone: APP_TIMEZONE },
          reminders: {
            useDefault: false,
            overrides: CALENDAR_REMINDER_OVERRIDES,
          },
        }),
      }
    )

    if (!response.ok) {
      const body = await response.text()
      console.error("[google-calendar] create event failed:", response.status, body)
      return null
    }

    const json = (await response.json()) as { id?: string }
    return json.id ?? null
  } catch (error) {
    console.error("[google-calendar] create event error:", error)
    return null
  }
}

async function patchCalendarEventForUser(
  user: CalendarUser,
  googleEventId: string,
  event: CalendarEventInput
): Promise<boolean> {
  try {
    const accessToken = await getValidGoogleAccessToken(user)
    const { start, end } = buildEventDateTimes(event)

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(
        googleEventId
      )}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: event.title,
          description: event.description,
          start: { dateTime: start, timeZone: APP_TIMEZONE },
          end: { dateTime: end, timeZone: APP_TIMEZONE },
          reminders: {
            useDefault: false,
            overrides: CALENDAR_REMINDER_OVERRIDES,
          },
        }),
      }
    )

    if (!response.ok) {
      const body = await response.text()
      console.error("[google-calendar] patch event failed:", response.status, body)
      return false
    }

    return true
  } catch (error) {
    console.error("[google-calendar] patch event error:", error)
    return false
  }
}

async function persistCalendarEvent(params: {
  projectId: string
  stepCode: string
  userId: string
  googleEventId: string
  eventType: EventType
}) {
  const service = createServiceClient()
  if (!service) return

  const { error } = await service.from("calendar_events").insert({
    project_id: params.projectId,
    step_code: params.stepCode,
    user_id: params.userId,
    google_event_id: params.googleEventId,
    event_type: params.eventType,
  })

  if (error) {
    console.error("[google-calendar] persist event id failed:", error.message)
  }
}

async function createEventsForDivision(
  division: Division,
  event: CalendarEventInput,
  meta: {
    projectId: string
    stepCode: string
    eventType: EventType
    actingUserId?: string
  }
): Promise<number> {
  if (!getGoogleOAuthConfig()) return 0

  const users = await resolveCalendarRecipients(division, meta.actingUserId)
  let created = 0

  for (const user of users) {
    const googleEventId = await createCalendarEventForUser(user, event)
    if (!googleEventId) continue

    await persistCalendarEvent({
      projectId: meta.projectId,
      stepCode: meta.stepCode,
      userId: user.id,
      googleEventId,
      eventType: meta.eventType,
    })
    created++
  }

  return created
}

function buildProjectDescription(params: {
  projectName: string
  customerName: string
  stepCode: string
  projectId: string
  extraLines?: string[]
}): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const lines = [
    `Project: ${params.projectName}`,
    `Customer: ${params.customerName}`,
    `Step: ${params.stepCode}`,
    ...(params.extraLines ?? []),
    `Link: ${appUrl}/projects/${params.projectId}`,
  ]
  return lines.join("\n")
}

/**
 * Clear popup/email reminders on existing Google Calendar events for a step
 * without deleting the events themselves. Used when a step is marked done.
 */
export async function clearCalendarRemindersForStep(params: {
  projectId: string
  stepCode: string
}): Promise<number> {
  if (!getGoogleOAuthConfig()) return 0

  const service = createServiceClient()
  if (!service) return 0

  const { data: rows, error } = await service
    .from("calendar_events")
    .select("id, user_id, google_event_id")
    .eq("project_id", params.projectId)
    .eq("step_code", params.stepCode)
    .eq("reminders_cleared", false)

  if (error || !rows || rows.length === 0) return 0

  let cleared = 0

  for (const row of rows) {
    const user = await getConnectedCalendarUser(row.user_id as string)
    if (!user) {
      // User disconnected calendar — mark cleared so we don't keep retrying.
      await service
        .from("calendar_events")
        .update({ reminders_cleared: true })
        .eq("id", row.id)
      continue
    }

    try {
      const accessToken = await getValidGoogleAccessToken(user)
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(
          row.google_event_id as string
        )}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reminders: {
              useDefault: false,
              overrides: [],
            },
          }),
        }
      )

      if (!response.ok) {
        const body = await response.text()
        // 404 / 410 = already deleted by user — treat as cleared.
        if (response.status !== 404 && response.status !== 410) {
          console.error(
            "[google-calendar] clear reminders failed:",
            response.status,
            body
          )
          continue
        }
      }

      await service
        .from("calendar_events")
        .update({ reminders_cleared: true })
        .eq("id", row.id)
      cleared++
    } catch (err) {
      console.error("[google-calendar] clear reminders error:", err)
    }
  }

  return cleared
}

export async function createStepUnlockCalendarEvents(params: {
  projectId: string
  stepCode: string
  actingUserId?: string
  eventDate?: string
}): Promise<number> {
  const step = getStep(params.stepCode)
  if (!step) return 0

  const service = createServiceClient()
  if (!service) return 0

  const { data: project } = await service
    .from("projects")
    .select("name, customer:customers(name)")
    .eq("id", params.projectId)
    .single()

  if (!project?.name) return 0

  const eventDate = params.eventDate ?? todayDateKeyWib()
  const customerName =
    normalizeRelation(project.customer as { name: string } | { name: string }[] | null)
      ?.name ?? "—"

  return createEventsForDivision(
    step.division,
    {
      title: `${step.code}: ${step.name} — ${project.name}`,
      description: buildProjectDescription({
        projectName: project.name,
        customerName,
        stepCode: params.stepCode,
        projectId: params.projectId,
        extraLines: [`PIC: ${getDivisionLabel(step.division)}`],
      }),
      dateKey: eventDate,
    },
    {
      projectId: params.projectId,
      stepCode: params.stepCode,
      eventType: "step_unlock",
      actingUserId: params.actingUserId,
    }
  )
}

export async function createFollowUpCalendarEvents(params: {
  projectId: string
  stepCode: string
  scheduledDate: string
  scheduledTime?: string
  note?: string | null
  actingUserId?: string
}): Promise<number> {
  const step = getStep(params.stepCode)
  if (!step) return 0

  const service = createServiceClient()
  if (!service) return 0

  const { data: project } = await service
    .from("projects")
    .select("name, customer:customers(name)")
    .eq("id", params.projectId)
    .single()

  if (!project?.name) return 0

  const customerName =
    normalizeRelation(project.customer as { name: string } | { name: string }[] | null)
      ?.name ?? "—"

  const extraLines = params.note?.trim()
    ? [`Catatan: ${params.note.trim()}`]
    : undefined

  return createEventsForDivision(
    step.division,
    {
      title: `Follow-up: ${step.code}: ${step.name} — ${project.name}`,
      description: buildProjectDescription({
        projectName: project.name,
        customerName,
        stepCode: params.stepCode,
        projectId: params.projectId,
        extraLines,
      }),
      dateKey: params.scheduledDate,
      timeKey: params.scheduledTime ?? "09:00:00",
    },
    {
      projectId: params.projectId,
      stepCode: params.stepCode,
      eventType: "followup",
      actingUserId: params.actingUserId,
    }
  )
}

/**
 * Move existing step_unlock Google Calendar events when a project anchor date
 * changes (e.g. Ex Work reschedule). Creates missing events for active steps.
 */
export async function resyncCalendarEventsForDateField(params: {
  projectId: string
  dateField: DateField
  actingUserId?: string
  newDateValue?: string
}): Promise<{ updated: number; created: number }> {
  if (!getGoogleOAuthConfig()) return { updated: 0, created: 0 }

  const service = createServiceClient()
  if (!service) return { updated: 0, created: 0 }

  const affectedStepCodes = getStepCodesUsingDateField(params.dateField)
  if (affectedStepCodes.length === 0) return { updated: 0, created: 0 }

  const [runtimeSteps, substepCompletions] = await Promise.all([
    loadRuntimeSteps(service),
    loadSubstepCompletionsForProject(service, params.projectId),
  ])

  const { data: project } = await service
    .from("projects")
    .select(
      `
      name,
      status,
      created_at,
      ex_work_date,
      etd_date,
      eta_date,
      mos_date,
      customer:customers(name),
      step_completions(step_code, completed_at)
    `
    )
    .eq("id", params.projectId)
    .single()

  if (!project?.name || project.status !== "active") {
    return { updated: 0, created: 0 }
  }

  const customerName =
    normalizeRelation(project.customer as { name: string } | { name: string }[] | null)
      ?.name ?? "—"

  const completions: CompletionInfo[] = (project.step_completions ?? []).map((row) => ({
    stepCode: row.step_code as string,
    completedAt: row.completed_at as string,
  }))

  const computedSteps = computeProjectSteps(completions, {
    createdAt: project.created_at as string,
    ex_work_date: project.ex_work_date as string | null,
    etd_date: project.etd_date as string | null,
    eta_date: project.eta_date as string | null,
    mos_date: project.mos_date as string | null,
  }, {
    steps: runtimeSteps,
    substepCompletions,
  })

  const computedByCode = new Map(computedSteps.map((step) => [step.definition.code, step]))

  const dateLabel = DATE_FIELD_LABELS[params.dateField]
  const dateValue =
    params.newDateValue ??
    (project[params.dateField as keyof typeof project] as string | null | undefined)

  const { data: calendarRows } = await service
    .from("calendar_events")
    .select("id, step_code, user_id, google_event_id")
    .eq("project_id", params.projectId)
    .eq("event_type", "step_unlock")
    .eq("reminders_cleared", false)
    .in("step_code", affectedStepCodes)

  let updated = 0
  const stepsWithEvents = new Set<string>()

  for (const row of calendarRows ?? []) {
    const stepCode = row.step_code as string
    stepsWithEvents.add(stepCode)

    const step = getStep(stepCode)
    const computed = computedByCode.get(stepCode)
    if (!step || !computed?.triggerAt) continue

    const user = await getConnectedCalendarUser(row.user_id as string)
    if (!user) continue

    const eventDate = dateToDateKeyWib(computed.triggerAt)
    const extraLines = [
      `PIC: ${getDivisionLabel(step.division)}`,
      ...(dateValue ? [`${dateLabel}: ${formatDateKey(dateValue)}`] : []),
    ]

    const ok = await patchCalendarEventForUser(user, row.google_event_id as string, {
      title: `${step.code}: ${step.name} — ${project.name}`,
      description: buildProjectDescription({
        projectName: project.name as string,
        customerName,
        stepCode,
        projectId: params.projectId,
        extraLines,
      }),
      dateKey: eventDate,
    })

    if (ok) {
      updated++
    } else {
      await service.from("calendar_events").delete().eq("id", row.id)
    }
  }

  let created = 0
  for (const stepCode of affectedStepCodes) {
    if (stepsWithEvents.has(stepCode)) continue

    const computed = computedByCode.get(stepCode)
    if (computed?.status !== "active" || !computed.triggerAt) continue

    const count = await createStepUnlockCalendarEvents({
      projectId: params.projectId,
      stepCode,
      actingUserId: params.actingUserId,
      eventDate: dateToDateKeyWib(computed.triggerAt),
    })
    created += count
  }

  return { updated, created }
}
