import type { DateField, StepTrigger } from "@/lib/steps"

const DATE_FIELDS = new Set<DateField>([
  "ex_work_date",
  "etd_date",
  "eta_date",
  "mos_date",
])

export function parseTriggerConfig(raw: unknown): StepTrigger | null {
  if (!raw || typeof raw !== "object") return null
  const obj = raw as Record<string, unknown>
  const type = obj.type

  if (type === "immediate") {
    return { type: "immediate" }
  }

  if (type === "interval") {
    const intervalDays = Number(obj.intervalDays)
    if (!Number.isFinite(intervalDays) || intervalDays < 1) return null
    return { type: "interval", intervalDays: Math.floor(intervalDays) }
  }

  if (type === "after_step") {
    const stepCode = typeof obj.stepCode === "string" ? obj.stepCode.trim() : ""
    const offsetDays = Number(obj.offsetDays)
    if (!stepCode || !Number.isFinite(offsetDays) || offsetDays < 0) return null
    const trigger: StepTrigger = {
      type: "after_step",
      stepCode,
      offsetDays: Math.floor(offsetDays),
    }
    const repeatDays = obj.repeatDays
    if (repeatDays != null && Number.isFinite(Number(repeatDays)) && Number(repeatDays) >= 1) {
      ;(trigger as { repeatDays?: number }).repeatDays = Math.floor(Number(repeatDays))
    }
    return trigger
  }

  if (type === "before_date" || type === "after_date") {
    const dateField = obj.dateField
    const offsetDays = Number(obj.offsetDays)
    if (typeof dateField !== "string" || !DATE_FIELDS.has(dateField as DateField)) {
      return null
    }
    if (!Number.isFinite(offsetDays) || offsetDays < 0) return null
    const trigger: StepTrigger = {
      type,
      dateField: dateField as DateField,
      offsetDays: Math.floor(offsetDays),
    }
    const repeatDays = obj.repeatDays
    if (repeatDays != null && Number.isFinite(Number(repeatDays)) && Number(repeatDays) >= 1) {
      ;(trigger as { repeatDays?: number }).repeatDays = Math.floor(Number(repeatDays))
    }
    return trigger
  }

  return null
}

export function triggerConfigsEqual(a: StepTrigger, b: StepTrigger): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export const TRIGGER_TYPE_LABELS: Record<StepTrigger["type"], string> = {
  immediate: "Langsung saat aktif",
  interval: "Setiap N hari (interval)",
  after_step: "N hari setelah step selesai",
  before_date: "N hari sebelum tanggal project",
  after_date: "N hari setelah tanggal project",
}
