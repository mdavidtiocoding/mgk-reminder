import fs from "fs"
import path from "path"

function decodeEnvBuffer(buf: Buffer): string {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.toString("utf16le")
  }
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.toString("utf8")
  }
  if (buf.length >= 2 && buf[1] === 0x00) {
    return buf.toString("utf16le")
  }
  return buf.toString("utf8")
}

function parseEnvContent(content: string): Record<string, string> {
  const vars: Record<string, string> = {}

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    const eq = trimmed.indexOf("=")
    if (eq === -1) continue

    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()

    const hash = value.indexOf(" #")
    if (hash !== -1) {
      value = value.slice(0, hash).trim()
    }

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (key) vars[key] = value
  }

  return vars
}

export function readLocalEnvFile(projectDir?: string): {
  path: string
  exists: boolean
  encoding: "utf8" | "utf16le" | "missing"
  vars: Record<string, string>
} {
  const dir = projectDir ?? process.cwd()
  const envPath = path.join(dir, ".env.local")

  if (!fs.existsSync(envPath)) {
    return { path: envPath, exists: false, encoding: "missing", vars: {} }
  }

  const buf = fs.readFileSync(envPath)
  let encoding: "utf8" | "utf16le" = "utf8"
  if (
    (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) ||
    (buf.length >= 2 && buf[1] === 0x00)
  ) {
    encoding = "utf16le"
  }

  return {
    path: envPath,
    exists: true,
    encoding,
    vars: parseEnvContent(decodeEnvBuffer(buf)),
  }
}

/** Load .env.local into process.env (handles UTF-16 saves from Windows editors). */
export function loadLocalEnv(projectDir?: string): void {
  const { vars } = readLocalEnvFile(projectDir)

  for (const [key, value] of Object.entries(vars)) {
    if (process.env[key] === undefined || process.env[key] === "") {
      process.env[key] = value
    }
  }
}

/** Rewrite .env.local as UTF-8 without BOM if it was UTF-16. */
export function normalizeLocalEnvFile(projectDir?: string): boolean {
  const info = readLocalEnvFile(projectDir)
  if (!info.exists || info.encoding === "utf8") return false

  const lines = Object.entries(info.vars).map(([key, value]) => {
    if (/[\s#"'=]/.test(value)) {
      return `${key}="${value.replace(/"/g, '\\"')}"`
    }
    return `${key}=${value}`
  })

  fs.writeFileSync(
    info.path,
    `${lines.join("\n")}\n`,
    { encoding: "utf8" }
  )

  return true
}
