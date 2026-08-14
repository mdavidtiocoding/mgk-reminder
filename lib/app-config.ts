import type { SupabaseClient } from "@supabase/supabase-js"

import {
  DELAY_THRESHOLD_HOURS,
  HOGGER_THRESHOLD_DAYS,
  WAITING_WARNING_DAYS,
} from "@/lib/constants"

export type AppThresholds = {
  hoggerDays: number
  warningDays: number
  delayHours: number
}

const DEFAULTS: AppThresholds = {
  hoggerDays: HOGGER_THRESHOLD_DAYS,
  warningDays: WAITING_WARNING_DAYS,
  delayHours: DELAY_THRESHOLD_HOURS,
}

function parsePositiveInt(value: string | null | undefined, fallback: number): number {
  if (!value) return fallback
  const n = parseInt(value, 10)
  return !isNaN(n) && n >= 1 ? n : fallback
}

export async function getAppThresholds(
  supabase: SupabaseClient
): Promise<AppThresholds> {
  const { data, error } = await supabase
    .from("app_config")
    .select("key, value")
    .in("key", ["hogger_days", "warning_days", "delay_hours"])

  if (error || !data) return { ...DEFAULTS }

  const map = new Map(data.map((row) => [row.key, row.value as string]))

  return {
    hoggerDays: parsePositiveInt(map.get("hogger_days"), DEFAULTS.hoggerDays),
    warningDays: parsePositiveInt(map.get("warning_days"), DEFAULTS.warningDays),
    delayHours: parsePositiveInt(map.get("delay_hours"), DEFAULTS.delayHours),
  }
}
