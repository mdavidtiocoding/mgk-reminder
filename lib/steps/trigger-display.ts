import { DATE_FIELD_LABELS, type StepDefinition, type StepTrigger } from "@/lib/steps"

export type TriggerBadge = {
  icon: string
  label: string
  variant?: "default" | "muted" | "repeat"
}

export function getTriggerBadges(trigger: StepTrigger): TriggerBadge[] {
  switch (trigger.type) {
    case "immediate":
      return [{ icon: "⚡", label: "Segera saat unlock" }]
    case "interval":
      return [
        { icon: "⏰", label: "Repeat interval" },
        { icon: "📅", label: formatDays(trigger.intervalDays), variant: "muted" as const },
      ]
    case "after_step":
      return [
        { icon: "⏰", label: `Setelah ${trigger.stepCode}` },
        { icon: "📅", label: formatDays(trigger.offsetDays), variant: "muted" as const },
        ...(trigger.repeatDays
          ? [{ icon: "🔁", label: formatRepeat(trigger.repeatDays), variant: "repeat" as const }]
          : []),
      ]
    case "before_date":
      return [
        { icon: "⏰", label: `Before ${shortDateField(trigger.dateField)}` },
        { icon: "📅", label: formatDays(trigger.offsetDays), variant: "muted" as const },
        ...(trigger.repeatDays
          ? [{ icon: "🔁", label: formatRepeat(trigger.repeatDays), variant: "repeat" as const }]
          : []),
      ]
    case "after_date":
      return [
        { icon: "⏰", label: `After ${shortDateField(trigger.dateField)}` },
        { icon: "📅", label: formatDays(trigger.offsetDays), variant: "muted" as const },
        ...(trigger.repeatDays
          ? [{ icon: "🔁", label: formatRepeat(trigger.repeatDays), variant: "repeat" as const }]
          : []),
      ]
    default:
      return []
  }
}

function shortDateField(field: keyof typeof DATE_FIELD_LABELS): string {
  const map: Record<string, string> = {
    ex_work_date: "Ex Work",
    etd_date: "ETD",
    eta_date: "ETA",
    mos_date: "MOS",
  }
  return map[field] ?? DATE_FIELD_LABELS[field]
}

function formatDays(days: number): string {
  return days === 1 ? "1 Day" : `${days} Days`
}

function formatRepeat(days: number): string {
  if (days === 1) return "Daily"
  return `Every ${days} Days`
}

export function describeTriggerFull(step: StepDefinition): string {
  const trigger = step.trigger
  switch (trigger.type) {
    case "immediate":
      return "Reminder segera saat step unlock"
    case "interval":
      return `Repeat reminder tiap ${trigger.intervalDays} hari`
    case "after_step":
      return `${trigger.offsetDays} hari setelah step ${trigger.stepCode} selesai${
        trigger.repeatDays ? `, repeat tiap ${trigger.repeatDays} hari` : ""
      }`
    case "before_date":
      return `${trigger.offsetDays} hari sebelum ${DATE_FIELD_LABELS[trigger.dateField]}${
        trigger.repeatDays ? `, repeat tiap ${trigger.repeatDays} hari` : ""
      }`
    case "after_date":
      return `${trigger.offsetDays} hari setelah ${DATE_FIELD_LABELS[trigger.dateField]}${
        trigger.repeatDays ? `, repeat tiap ${trigger.repeatDays} hari` : ""
      }`
    default:
      return ""
  }
}
