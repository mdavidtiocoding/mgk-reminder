/** Days before a step is flagged as stuck (hogger). Configurable in Settings. */
export const HOGGER_THRESHOLD_DAYS = 5

/** Days before "waiting since" text turns red. */
export const WAITING_WARNING_DAYS = 3

/** Hours after unlock to respond before a step is Delay. Default 1×24 jam. */
export const DELAY_THRESHOLD_HOURS = 24

/** App timezone — Indonesia Western Time (UTC+7). */
export const APP_TIMEZONE = "Asia/Jakarta"

/**
 * Vercel Cron uses UTC. 01:00 UTC = 08:00 WIB (daily reminder run).
 * @see vercel.json
 */
export const CRON_SCHEDULE_WIB = "08:00 WIB"
