import fs from "node:fs"

const envPath = ".env.local"
const text = fs.readFileSync(envPath, "utf8")

function get(name) {
  const line = text.split(/\r?\n/).find((l) => l.startsWith(`${name}=`))
  if (!line) return null
  return line.slice(name.length + 1).trim()
}

const url = get("NEXT_PUBLIC_SUPABASE_URL")
const anon = get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
const service = get("SUPABASE_SERVICE_ROLE_KEY")

console.log("=== .env.local check ===")
console.log("URL:", url ?? "MISSING")
console.log(
  "ANON:",
  !anon
    ? "MISSING"
    : anon.includes("PASTE")
      ? "PLACEHOLDER (belum diisi!)"
      : `OK (length ${anon.length})`
)
console.log(
  "SERVICE:",
  !service
    ? "MISSING"
    : service.includes("PASTE")
      ? "PLACEHOLDER (belum diisi!)"
      : `OK (length ${service.length})`
)

if (!url || !anon || anon.includes("PASTE")) {
  console.log("\n❌ Key belum tersimpan. Paste key dari Supabase → Ctrl+S → restart npm run dev")
  process.exit(1)
}

const res = await fetch(`${url}/auth/v1/health`, {
  headers: { apikey: anon, Authorization: `Bearer ${anon}` },
})
const body = await res.text()
console.log("\nSupabase test:", res.status, body.slice(0, 80))
if (res.ok || body.includes("GoTrue") || res.status === 200) {
  console.log("✅ API key valid")
} else if (body.includes("Invalid API key")) {
  console.log("❌ Key salah — copy ulang dari Supabase Settings → API")
  process.exit(1)
}
