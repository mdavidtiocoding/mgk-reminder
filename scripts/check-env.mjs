import fs from "node:fs"

const text = fs.readFileSync(".env.local", "utf8")
const urlLine = text.split(/\r?\n/).find((l) => l.startsWith("NEXT_PUBLIC_SUPABASE_URL"))
if (!urlLine) {
  console.log("MISSING NEXT_PUBLIC_SUPABASE_URL")
  process.exit(1)
}

const match = urlLine.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)
if (!match) {
  console.log("INVALID URL LINE:", urlLine.slice(0, 50))
  process.exit(1)
}

const ref = match[1]
console.log("supabase_ref:", ref)
console.log("korea_dead:", ref === "tsmcadpatnmnbkjmqmtx")
console.log("singapore:", ref === "olueevuuotsmnfxmgyvz")
