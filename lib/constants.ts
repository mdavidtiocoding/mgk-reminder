/** Days before a step is flagged as stuck (hogger). Configurable in Settings later. */
export const HOGGER_THRESHOLD_DAYS = 5

/** Days before "waiting since" text turns red. */
export const WAITING_WARNING_DAYS = 3

/** App timezone — Indonesia Western Time (UTC+7). */
export const APP_TIMEZONE = "Asia/Jakarta"

/**
 * Vercel Cron uses UTC. 01:00 UTC = 08:00 WIB (daily reminder run).
 * @see vercel.json
 */
export const CRON_SCHEDULE_WIB = "08:00 WIB"
