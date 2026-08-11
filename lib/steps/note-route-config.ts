export type NoteRouteConfig = {
  enabled: boolean
  targets: string[]
}

export type NoteRouteTarget = {
  code: string
  name: string
}

export type IncomingStepNote = {
  fromStep: string
  fromName: string
  message: string
}

export const EMPTY_NOTE_ROUTE: NoteRouteConfig = {
  enabled: false,
  targets: [],
}

export function parseNoteRouteConfig(raw: unknown): NoteRouteConfig {
  if (!raw || typeof raw !== "object") return { ...EMPTY_NOTE_ROUTE }
  const obj = raw as Record<string, unknown>
  const targets = Array.isArray(obj.targets)
    ? obj.targets
        .filter((code): code is string => typeof code === "string")
        .map((code) => code.trim())
        .filter(Boolean)
    : []
  return {
    enabled: obj.enabled === true,
    targets: [...new Set(targets)],
  }
}

export function serializeNoteRouteConfig(config: NoteRouteConfig): NoteRouteConfig {
  const targets = [...new Set(config.targets.map((code) => code.trim()).filter(Boolean))]
  return {
    enabled: config.enabled === true,
    targets,
  }
}

export function isNoteRouteEnabled(config?: NoteRouteConfig | null): boolean {
  return Boolean(config?.enabled && (config.targets?.length ?? 0) > 0)
}

export function noteRouteConfigsEqual(a: NoteRouteConfig, b: NoteRouteConfig): boolean {
  if (a.enabled !== b.enabled) return false
  if (a.targets.length !== b.targets.length) return false
  return a.targets.every((code, i) => code === b.targets[i])
}

export function resolveNoteRouteTargets(
  config: NoteRouteConfig | undefined,
  steps: { code: string; name: string }[]
): NoteRouteTarget[] {
  if (!isNoteRouteEnabled(config) || !config) return []
  const nameByCode = new Map(steps.map((step) => [step.code, step.name]))
  return config.targets.map((code) => ({
    code,
    name: nameByCode.get(code) ?? code,
  }))
}

export function formatNoteRouteLine(options: {
  presence: "ada" | "tidak"
  toStep?: string
  message?: string
}): string {
  if (options.presence === "tidak") return "Tidak ada"
  const to = options.toStep?.trim() || "?"
  const message = options.message?.trim()
  return message ? `Ada → ${to}\n${message}` : `Ada → ${to}`
}
