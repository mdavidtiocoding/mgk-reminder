import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { execSync } from "node:child_process"

const tempFile = path.join(os.tmpdir(), "mgk-env-pull")
const target = path.resolve(".env.local")

execSync(`npx vercel env pull "${tempFile}" --environment=production --yes`, {
  stdio: "inherit",
})

const pulled = fs.readFileSync(tempFile, "utf8")
const url = pulled.match(/NEXT_PUBLIC_SUPABASE_URL="([^"]+)"/)?.[1] ?? ""
const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] ?? "?"

console.log("Pulled Supabase ref:", ref)

if (!url.includes("olueevuuotsmnfxmgyvz")) {
  console.warn("Warning: expected Singapore ref olueevuuotsmnfxmgyvz")
}

const localOverrides = {
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  GOOGLE_REDIRECT_URI: "http://localhost:3000/api/auth/google/callback",
}

const merged = new Map()
for (const line of pulled.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)="(.*)"$/)
  if (m) merged.set(m[1], m[2])
}

for (const [key, value] of Object.entries(localOverrides)) {
  merged.set(key, value)
}

const skip = new Set([
  "VERCEL",
  "VERCEL_ENV",
  "VERCEL_URL",
  "VERCEL_OIDC_TOKEN",
  "VERCEL_GIT_COMMIT_AUTHOR_LOGIN",
  "VERCEL_GIT_COMMIT_AUTHOR_NAME",
  "VERCEL_GIT_COMMIT_MESSAGE",
  "VERCEL_GIT_COMMIT_REF",
  "VERCEL_GIT_COMMIT_SHA",
  "VERCEL_GIT_PREVIOUS_SHA",
  "VERCEL_GIT_PROVIDER",
  "VERCEL_GIT_PULL_REQUEST_ID",
  "VERCEL_GIT_REPO_ID",
  "VERCEL_GIT_REPO_OWNER",
  "VERCEL_GIT_REPO_SLUG",
  "VERCEL_TARGET_ENV",
  "NX_DAEMON",
  "TURBO_CACHE",
  "TURBO_DOWNLOAD_LOCAL_ENABLED",
  "TURBO_REMOTE_ONLY",
  "TURBO_RUN_SUMMARY",
])

const lines = [
  "# Synced from Vercel production + local overrides",
  ...[...merged.entries()]
    .filter(([key]) => !skip.has(key))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`),
  "",
]

fs.writeFileSync(target, lines.join("\n"))
console.log("Wrote", target)
