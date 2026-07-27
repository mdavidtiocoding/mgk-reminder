export const STEP_COMPLETION_MODES = [
  "normal",
  "checklist",
  "keterangan",
  "checklist_keterangan",
] as const

export type StepCompletionMode = (typeof STEP_COMPLETION_MODES)[number]

export const COMPLETION_MODE_LABELS: Record<StepCompletionMode, string> = {
  normal: "Step Normal",
  checklist: "Step Checklist",
  keterangan: "Step Keterangan",
  checklist_keterangan: "Checklist + Keterangan",
}

export const COMPLETION_MODE_DESCRIPTIONS: Record<StepCompletionMode, string> = {
  normal: "Tombol Tandai Selesai — catatan opsional.",
  checklist: "Setiap item checklist wajib dicentang atau diberi catatan.",
  keterangan: "Wajib isi keterangan/catatan sebelum selesai.",
  checklist_keterangan:
    "Setiap item checklist wajib dicentang atau diberi catatan, plus keterangan umum.",
}

export const COMPLETION_MODE_BADGES: Record<StepCompletionMode, string> = {
  normal: "bg-slate-100 text-slate-700",
  checklist: "bg-amber-100 text-amber-800",
  keterangan: "bg-sky-100 text-sky-800",
  checklist_keterangan: "bg-violet-100 text-violet-800",
}

export function parseCompletionMode(value: unknown): StepCompletionMode {
  if (
    typeof value === "string" &&
    STEP_COMPLETION_MODES.includes(value as StepCompletionMode)
  ) {
    return value as StepCompletionMode
  }
  return "normal"
}

export function requiresChecklist(mode: StepCompletionMode): boolean {
  return mode === "checklist" || mode === "checklist_keterangan"
}

export function requiresKeterangan(mode: StepCompletionMode): boolean {
  return mode === "keterangan" || mode === "checklist_keterangan"
}

/** Infer mode from legacy checklist_items when completion_mode column missing. */
export function inferCompletionMode(
  checklistItems: string[] | null | undefined,
  storedMode?: string | null
): StepCompletionMode {
  const parsed = storedMode ? parseCompletionMode(storedMode) : null
  if (parsed && parsed !== "normal") return parsed
  if (checklistItems && checklistItems.length > 0) return "checklist"
  return parsed ?? "normal"
}

export function validateCompletionModeConfig(
  mode: StepCompletionMode,
  checklistItems: string[]
): string | null {
  if (requiresChecklist(mode) && checklistItems.length === 0) {
    return "Mode checklist membutuhkan minimal 1 item checklist."
  }
  return null
}
