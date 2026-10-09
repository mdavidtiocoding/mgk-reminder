import { redirect } from "next/navigation"

import { DelaySummaryView } from "@/components/delay-summary/delay-summary-view"
import { getSessionProfile, getSessionUser } from "@/lib/auth/session"
import {
  isUserSuperAdmin,
  resolveUserDivisions,
} from "@/lib/auth/user-divisions"
import { getDelaySummary, type DelaySummaryRow } from "@/lib/projects/delay-summary"
import { createClient } from "@/lib/supabase/server"

export default async function DelaySummaryPage() {
  const user = await getSessionUser()

  if (!user) {
    redirect("/login")
  }

  const [supabase, profile] = await Promise.all([
    createClient(),
    getSessionProfile(user.id),
  ])

  const userDivisions = resolveUserDivisions(profile)
  if (!isUserSuperAdmin(userDivisions)) {
    redirect("/")
  }

  let rows: DelaySummaryRow[] = []
  try {
    rows = await getDelaySummary(supabase, userDivisions)
  } catch {
    rows = []
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 p-6">
      <div>
        <h2 className="text-base font-medium">Delay Summary</h2>
        <p className="text-sm text-muted-foreground">
          Ringkasan semua step yang Delay, menunggu response, atau sedang
          extend — per project & divisi.
        </p>
      </div>
      <DelaySummaryView rows={rows} />
    </main>
  )
}
