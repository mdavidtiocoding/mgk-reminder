import { APP_TIMEZONE } from "@/lib/constants"

const dateTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: APP_TIMEZONE,
})

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "long",
  timeZone: APP_TIMEZONE,
})

export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso))
}

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso))
}

/** Format YYYY-MM-DD date key (WIB calendar date). */
export function formatDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number)
  return dateFormatter.format(new Date(Date.UTC(y, m - 1, d)))
}

export function todayDateKeyWib(): string {
  return dateToDateKeyWib(new Date())
}

/** Format any Date/ISO value as a YYYY-MM-DD WIB calendar date key. */
export function dateToDateKeyWib(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + days))
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(next)
}

/** Parse HH:mm or HH:mm:ss into hour/minute (WIB). */
export function parseTimeKey(timeKey: string): { hour: number; minute: number } {
  const [hourPart, minutePart] = timeKey.split(":")
  return {
    hour: Number(hourPart) || 9,
    minute: Number(minutePart) || 0,
  }
}

/** Format time key as HH:mm WIB. */
export function formatTimeKey(timeKey: string): string {
  const { hour, minute } = parseTimeKey(timeKey)
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} WIB`
}

export function formatFollowUpSchedule(dateKey: string, timeKey: string): string {
  return `${formatDateKey(dateKey)}, ${formatTimeKey(timeKey)}`
}

/** WIB scheduled date + time as Date. */
export function wibScheduleToDate(dateKey: string, timeKey: string): Date {
  const { hour, minute } = parseTimeKey(timeKey)
  const [y, m, d] = dateKey.split("-").map(Number)
  const pad = (n: number) => String(n).padStart(2, "0")
  return new Date(`${y}-${pad(m)}-${pad(d)}T${pad(hour)}:${pad(minute)}:00+07:00`)
}

/** True when current time is at or after `leadMinutes` before the scheduled WIB time. */
export function isFollowUpReminderDue(
  dateKey: string,
  timeKey: string,
  leadMinutes = 30
): boolean {
  const scheduledMs = wibScheduleToDate(dateKey, timeKey).getTime()
  const remindAtMs = scheduledMs - leadMinutes * 60 * 1000
  return Date.now() >= remindAtMs
}

/** Calendar days elapsed since `iso` in WIB (for hogger / waiting counters). */
export function daysSinceWib(iso: string | Date): number {
  const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })

  const toUtcDay = (key: string) => {
    const [y, m, d] = key.split("-").map(Number)
    return Date.UTC(y, m - 1, d)
  }

  const start = typeof iso === "string" ? new Date(iso) : iso
  const startKey = dayKeyFormatter.format(start)
  const todayKey = dayKeyFormatter.format(new Date())

  return Math.max(0, Math.floor((toUtcDay(todayKey) - toUtcDay(startKey)) / 86400000))
}
