import type { StepCompletionMode } from "@/lib/steps/completion-mode"

export type Division =
  | "marketing"
  | "ar"
  | "logistik"
  | "finance"
  | "shipping"
  | "project"
  | "admin"

export type ProjectStatus = "active" | "completed" | "on_hold"

/** Project-level dates captured during the flow (Shipping inputs these). */
export type DateField = "ex_work_date" | "etd_date" | "eta_date" | "mos_date"

export const DATE_FIELD_LABELS: Record<DateField, string> = {
  ex_work_date: "Ex Work Date",
  etd_date: "ETD (Estimated Time of Departure)",
  eta_date: "ETA (Estimated Time of Arrival)",
  mos_date: "MOS Date (Material on Site)",
}

/**
 * Reminder trigger definitions.
 * - immediate: fires once as soon as the step becomes active (unlocked)
 * - interval: repeats every N days from the moment the step became active
 * - after_step: fires N days after a specific prerequisite step is completed, can repeat
 * - before_date / after_date: relative to a project date field (ex_work_date, etd_date, etc.)
 */
export type StepTrigger =
  | { type: "immediate" }
  | { type: "interval"; intervalDays: number }
  | { type: "after_step"; stepCode: string; offsetDays: number; repeatDays?: number }
  | { type: "before_date"; dateField: DateField; offsetDays: number; repeatDays?: number }
  | { type: "after_date"; dateField: DateField; offsetDays: number; repeatDays?: number }

export type DateInputField = {
  field: DateField
  label: string
}

export type StepDefinition = {
  code: string
  name: string
  division: Division
  stage: number
  order: number
  /** Step codes that must ALL be completed before this step becomes active. */
  prerequisites: string[]
  /** Optional checklist that must be fully checked before Mark as Done is enabled. */
  checklist?: string[]
  /** Mark-as-done behavior — configurable in Flow Config. */
  completionMode?: StepCompletionMode
  /** Date field(s) captured on this project when this step is marked done. */
  dateInputs?: DateInputField[]
  /** Whether this step has an OK / reschedule outcome (e.g. survey result). */
  hasOutcome?: boolean
  trigger: StepTrigger
}

export const STEPS: StepDefinition[] = [
  // FASE 1 — Sales & DP
  {
    code: "M1",
    name: "Penerimaan PO dari Customer",
    division: "marketing",
    stage: 1,
    order: 1,
    prerequisites: [],
    trigger: { type: "immediate" },
  },
  {
    code: "M2",
    name: "Persetujuan Internal",
    division: "marketing",
    stage: 1,
    order: 2,
    prerequisites: ["M1"],
    trigger: { type: "immediate" },
  },
  {
    code: "A1",
    name: "Penagihan Down Payment ke Customer",
    division: "ar",
    stage: 1,
    order: 3,
    prerequisites: ["M1"],
    trigger: { type: "after_step", stepCode: "M1", offsetDays: 1 },
  },
  {
    code: "M3",
    name: "Pengiriman Sales Contract ke Pabrik",
    division: "marketing",
    stage: 1,
    order: 4,
    prerequisites: ["M2"],
    trigger: { type: "immediate" },
  },
  {
    code: "P1",
    name: "Survey Lokasi Customer",
    division: "project",
    stage: 1,
    order: 5,
    prerequisites: ["M1"],
    trigger: { type: "immediate" },
  },

  // FASE 2 — Logistik & Finance Pre-Shipment
  {
    code: "L1",
    name: "Pengiriman Purchase Order ke Pabrik",
    division: "logistik",
    stage: 2,
    order: 6,
    prerequisites: ["A1", "M3"],
    trigger: { type: "immediate" },
  },
  {
    code: "F1",
    name: "Pembayaran Down Payment ke Pabrik",
    division: "finance",
    stage: 2,
    order: 7,
    prerequisites: ["L1"],
    trigger: { type: "after_step", stepCode: "L1", offsetDays: 2 },
  },
  {
    code: "S1",
    name: "Konfirmasi Ex Work Date",
    division: "shipping",
    stage: 2,
    order: 8,
    prerequisites: ["F1"],
    dateInputs: [{ field: "ex_work_date", label: "Ex Work Date" }],
    trigger: { type: "after_step", stepCode: "F1", offsetDays: 4, repeatDays: 2 },
  },

  // FASE 3 — Pre-Shipment (PARALLEL)
  {
    code: "A2",
    name: "Pemeriksaan Dokumen Pre-Shipment",
    division: "ar",
    stage: 3,
    order: 9,
    prerequisites: ["S1"],
    trigger: { type: "before_date", dateField: "ex_work_date", offsetDays: 10, repeatDays: 1 },
  },
  {
    code: "P2",
    name: "Survey Kesiapan Lokasi MOS",
    division: "project",
    stage: 3,
    order: 10,
    prerequisites: ["S1"],
    hasOutcome: true,
    trigger: { type: "before_date", dateField: "ex_work_date", offsetDays: 7, repeatDays: 1 },
  },

  // FASE 4 — Shipping (PARALLEL from P2 done)
  {
    code: "L2",
    name: "Checklist Penitipan Spare Part",
    division: "logistik",
    stage: 4,
    order: 11,
    prerequisites: ["P2"],
    trigger: { type: "immediate" },
  },
  {
    code: "S2",
    name: "Checklist Pre-Shipment",
    division: "shipping",
    stage: 4,
    order: 12,
    prerequisites: ["P2"],
    trigger: { type: "immediate" },
  },
  {
    code: "S3",
    name: "Pencarian & Seleksi Kapal",
    division: "shipping",
    stage: 4,
    order: 13,
    prerequisites: ["P2", "A2"],
    trigger: { type: "immediate" },
  },
  {
    code: "S4",
    name: "Booking Kapal & Verifikasi Dokumen Import / DNP",
    division: "shipping",
    stage: 4,
    order: 14,
    prerequisites: ["S3", "F2"],
    dateInputs: [
      { field: "etd_date", label: "ETD (Estimated Time of Departure)" },
      { field: "eta_date", label: "ETA (Estimated Time of Arrival)" },
    ],
    trigger: { type: "after_step", stepCode: "S3", offsetDays: 2, repeatDays: 1 },
  },
  {
    code: "S5",
    name: "Konfirmasi Tanggal MOS",
    division: "shipping",
    stage: 4,
    order: 15,
    prerequisites: ["P2"],
    dateInputs: [{ field: "mos_date", label: "MOS Date (Material on Site)" }],
    trigger: { type: "immediate" },
  },
  {
    code: "F2",
    name: "Pembayaran Biaya Pengiriman",
    division: "finance",
    stage: 4,
    order: 16,
    prerequisites: ["S3"],
    trigger: { type: "after_step", stepCode: "S3", offsetDays: 2, repeatDays: 1 },
  },

  // FASE 5 — Post ETD (PARALLEL from S4 done)
  {
    code: "A3",
    name: "Penerimaan Copy Bill of Lading",
    division: "ar",
    stage: 5,
    order: 17,
    prerequisites: ["S4"],
    trigger: { type: "after_date", dateField: "etd_date", offsetDays: 4 },
  },
  {
    code: "F3",
    name: "Pembayaran Ship Cost & Asuransi",
    division: "finance",
    stage: 5,
    order: 18,
    prerequisites: ["S4"],
    trigger: { type: "after_date", dateField: "etd_date", offsetDays: 1 },
  },
  {
    code: "S6",
    name: "Pemeriksaan Dokumen Kepabeanan",
    division: "shipping",
    stage: 5,
    order: 19,
    prerequisites: ["S4"],
    trigger: { type: "after_date", dateField: "etd_date", offsetDays: 5 },
  },

  // FASE 6 — Pre-Arrival & MOS (PARALLEL)
  {
    code: "F4",
    name: "Pengurusan PIB (Pemberitahuan Impor Barang)",
    division: "finance",
    stage: 6,
    order: 20,
    prerequisites: ["S6"],
    trigger: { type: "before_date", dateField: "eta_date", offsetDays: 5 },
  },
  {
    code: "P3",
    name: "Persiapan Material on Site",
    division: "project",
    stage: 6,
    order: 21,
    prerequisites: ["S5"],
    checklist: ["Forklift", "Truck", "Terpal", "Triplek"],
    trigger: { type: "before_date", dateField: "mos_date", offsetDays: 10 },
  },
  {
    code: "P5",
    name: "Persiapan Tim Instalasi",
    division: "project",
    stage: 6,
    order: 22,
    prerequisites: ["S5"],
    checklist: ["Subkon", "Kos", "Steger", "Motor", "Tiket luar kota"],
    trigger: { type: "before_date", dateField: "mos_date", offsetDays: 10 },
  },

  // FASE 7 — MOS & Instalasi
  {
    code: "P4",
    name: "Penerimaan Material on Site",
    division: "project",
    stage: 7,
    order: 23,
    prerequisites: ["F4"],
    trigger: { type: "after_step", stepCode: "F4", offsetDays: 1 },
  },
  {
    code: "A4",
    name: "Konfirmasi Penerimaan MOS",
    division: "ar",
    stage: 7,
    order: 24,
    prerequisites: ["P4"],
    trigger: { type: "after_step", stepCode: "P4", offsetDays: 1 },
  },
  {
    code: "P6",
    name: "Pelaksanaan Instalasi",
    division: "project",
    stage: 7,
    order: 25,
    prerequisites: ["P4", "A4"],
    trigger: { type: "immediate" },
  },
  {
    code: "A5",
    name: "Konfirmasi Pemasangan Sangkar",
    division: "ar",
    stage: 7,
    order: 26,
    prerequisites: ["P6"],
    trigger: { type: "after_step", stepCode: "P6", offsetDays: 1 },
  },

  // FASE 8 — Tescom & BAST
  {
    code: "P7",
    name: "Pelaksanaan Test Commissioning",
    division: "project",
    stage: 8,
    order: 27,
    prerequisites: ["A5"],
    trigger: { type: "immediate" },
  },
  {
    code: "A6",
    name: "Konfirmasi Test Commissioning",
    division: "ar",
    stage: 8,
    order: 28,
    prerequisites: ["P7"],
    trigger: { type: "after_step", stepCode: "P7", offsetDays: 1 },
  },
  {
    code: "P8",
    name: "Berita Acara Serah Terima 1",
    division: "project",
    stage: 8,
    order: 29,
    prerequisites: ["A6"],
    trigger: { type: "after_step", stepCode: "A6", offsetDays: 1 },
  },
  {
    code: "A7",
    name: "Konfirmasi BAST 1",
    division: "ar",
    stage: 8,
    order: 30,
    prerequisites: ["P8"],
    trigger: { type: "after_step", stepCode: "P8", offsetDays: 1 },
  },
  {
    code: "P9",
    name: "Berita Acara Serah Terima 2",
    division: "project",
    stage: 8,
    order: 31,
    prerequisites: ["A7"],
    trigger: { type: "after_step", stepCode: "A7", offsetDays: 1 },
  },
  {
    code: "A8",
    name: "Konfirmasi BAST 2",
    division: "ar",
    stage: 8,
    order: 32,
    prerequisites: ["P9"],
    trigger: { type: "after_step", stepCode: "P9", offsetDays: 1 },
  },
]

export const TOTAL_STEP_COUNT = STEPS.length

export const DIVISION_LABELS: Record<Division, string> = {
  marketing: "Marketing",
  ar: "AR",
  logistik: "Logistik",
  finance: "Finance",
  shipping: "Shipping",
  project: "Project",
  admin: "Admin",
}

/** Shared per-division visual accents (left border + small badge) used across the UI. */
export const DIVISION_BADGE_STYLES: Record<Division, { border: string; badge: string }> = {
  marketing: { border: "border-l-blue-400", badge: "bg-blue-100 text-blue-700" },
  ar: { border: "border-l-purple-400", badge: "bg-purple-100 text-purple-700" },
  finance: { border: "border-l-green-400", badge: "bg-green-100 text-green-700" },
  project: { border: "border-l-orange-400", badge: "bg-orange-100 text-orange-700" },
  shipping: { border: "border-l-cyan-400", badge: "bg-cyan-100 text-cyan-700" },
  logistik: { border: "border-l-yellow-400", badge: "bg-yellow-100 text-yellow-700" },
  admin: { border: "border-l-slate-400", badge: "bg-slate-100 text-slate-700" },
}

export const STAGE_LABELS: Record<number, string> = {
  1: "Sales & DP",
  2: "Pre-Shipment",
  3: "Survey & Dokumen",
  4: "Shipping",
  5: "Post ETD",
  6: "Pre-Arrival",
  7: "MOS & Instalasi",
  8: "Tescom & BAST",
}

export const TOTAL_STAGE_COUNT = Object.keys(STAGE_LABELS).length

const stepMap = new Map(STEPS.map((step) => [step.code, step]))

export function getStep(stepCode: string): StepDefinition | undefined {
  return stepMap.get(stepCode)
}

export function getStageForStep(stepCode: string): number {
  return getStep(stepCode)?.stage ?? 1
}

export function getDivisionLabel(division: Division): string {
  return DIVISION_LABELS[division] ?? division
}

export function describeTrigger(step: StepDefinition): string {
  const trigger = step.trigger
  switch (trigger.type) {
    case "immediate":
      return "Segera saat step unlock"
    case "interval":
      return `Repeat tiap ${trigger.intervalDays} hari`
    case "after_step":
      return `${trigger.offsetDays} hari setelah ${trigger.stepCode} selesai${
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

/** Step codes with no prerequisites — active from the moment a project is created. */
export function getInitialStepCodes(): string[] {
  return STEPS.filter((step) => step.prerequisites.length === 0).map((step) => step.code)
}

/**
 * A step is active when all its prerequisites are in `doneCodes` and it is
 * not itself already done. Supports the parallel/DAG flow (not just linear).
 */
export function isStepActive(step: StepDefinition, doneCodes: Set<string>): boolean {
  if (doneCodes.has(step.code)) return false
  return step.prerequisites.every((code) => doneCodes.has(code))
}

export function getActiveSteps(doneCodes: Set<string>): StepDefinition[] {
  return STEPS.filter((step) => isStepActive(step, doneCodes))
}

export function isProjectFullyDone(doneCodes: Set<string>): boolean {
  return STEPS.every((step) => doneCodes.has(step.code))
}
