export const RESCHEDULE_CHANNEL_PREFIX = "reschedule:"

export type RescheduleLogEntry = {
  stepCode: string
  newExWorkDate: string
  rescheduledAt: string
}

export function buildRescheduleChannel(newExWorkDate: string): string {
  return `${RESCHEDULE_CHANNEL_PREFIX}${newExWorkDate}`
}

export function parseRescheduleChannel(channel: string): string | null {
  if (!channel.startsWith(RESCHEDULE_CHANNEL_PREFIX)) return null
  const date = channel.slice(RESCHEDULE_CHANNEL_PREFIX.length)
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null
}

export function isRescheduleChannel(channel: string): boolean {
  return channel.startsWith(RESCHEDULE_CHANNEL_PREFIX)
}

/** Latest reschedule per step from reminder_log rows. */
export function indexLatestReschedules(
  logs: Array<{ step_code: string; sent_at: string; channel: string }>
): Map<string, RescheduleLogEntry> {
  const map = new Map<string, RescheduleLogEntry>()

  for (const log of logs) {
    const newExWorkDate = parseRescheduleChannel(log.channel)
    if (!newExWorkDate) continue

    const existing = map.get(log.step_code)
    if (!existing || log.sent_at > existing.rescheduledAt) {
      map.set(log.step_code, {
        stepCode: log.step_code,
        newExWorkDate,
        rescheduledAt: log.sent_at,
      })
    }
  }

  return map
}
