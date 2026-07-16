import fs from "fs"
import path from "path"

const envPath = path.join(process.cwd(), ".env.local")

if (!fs.existsSync(envPath)) {
  console.warn("[ensure-env] .env.local not found")
  process.exit(0)
}

const buf = fs.readFileSync(envPath)
const isUtf16 =
  (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) ||
  (buf.length >= 2 && buf[1] === 0x00)

if (!isUtf16) {
  console.log("[ensure-env] .env.local encoding OK (UTF-8)")
  process.exit(0)
}

const content = buf.toString("utf16le")
const lines = []

for (const line of content.split(/\r?\n/)) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith("#")) continue
  const eq = trimmed.indexOf("=")
  if (eq === -1) continue
  const key = trimmed.slice(0, eq).trim()
  let value = trimmed.slice(eq + 1).trim()
  const hash = value.indexOf(" #")
  if (hash !== -1) value = value.slice(0, hash).trim()
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1)
  }
  if (/[\s#"'=]/.test(value)) {
    lines.push(`${key}="${value.replace(/"/g, '\\"')}"`)
  } else {
    lines.push(`${key}=${value}`)
  }
}

fs.writeFileSync(envPath, `${lines.join("\n")}\n`, { encoding: "utf8" })
console.log("[ensure-env] Converted .env.local from UTF-16 to UTF-8")
