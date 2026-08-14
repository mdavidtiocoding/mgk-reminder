import { DELAY_THRESHOLD_HOURS } from "@/lib/constants"

export function parseDelayHours(value: unknown): number | null {
  if (value == null || value === "") return null
  const n = typeof value === "number" ? value : parseInt(String(value), 10)
  if (!Number.isInteger(n) || n < 1) return null
  return n
}

export function resolveDelayHours(
  stepDelayHours: number | null | undefined,
  globalDelayHours: number = DELAY_THRESHOLD_HOURS
): number {
  return stepDelayHours != null && stepDelayHours >= 1
    ? stepDelayHours
    : globalDelayHours
}

export function hoursSince(iso: string | Date): number {
  const start = typeof iso === "string" ? new Date(iso) : iso
  if (Number.isNaN(start.getTime())) return 0
  return Math.max(0, (Date.now() - start.getTime()) / 3_600_000)
}

export function isPastDelayThreshold(
  unlockedAt: Date | string | null | undefined,
  delayHours: number
): boolean {
  if (!unlockedAt || delayHours < 1) return false
  return hoursSince(unlockedAt) >= delayHours
}

/** Label for elapsed/overdue time, e.g. "12 jam" or "2 hari". */
export function formatDelayDuration(elapsedHours: number): string {
  const hours = Math.max(0, Math.floor(elapsedHours))
  if (hours < 24) return `${hours} jam`
  const days = Math.floor(hours / 24)
  const rem = hours % 24
  if (rem === 0) return `${days} hari`
  return `${days} hari ${rem} jam`
}

/** How long past the response window. */
export function overdueHours(
  elapsedHours: number,
  delayHours: number
): number {
  return Math.max(0, elapsedHours - delayHours)
}
