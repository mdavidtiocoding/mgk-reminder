import { APP_TIMEZONE } from "@/lib/constants"
import { parseTimeKey, todayDateKeyWib } from "@/lib/format"
import { getDivisionLabel, getStep, type Division } from "@/lib/steps"
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
    .eq("division", division)
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
    const { hour, minute } = parseTimeKey(event.timeKey ?? "09:00")
    const start = wibDateTimeIso(event.dateKey, hour, minute)
    const endMinute = minute + 30
    const end = wibDateTimeIso(
      event.dateKey,
      hour + Math.floor(endMinute / 60),
      endMinute % 60
    )

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
          // useDefault must be false for overrides to apply (Google API).
          reminders: {
            useDefault: false,
            overrides: [
              { method: "popup", minutes: 30 },
              { method: "popup", minutes: 10 },
              { method: "popup", minutes: 0 },
            ],
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
