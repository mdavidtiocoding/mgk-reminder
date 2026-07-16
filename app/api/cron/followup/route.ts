import { NextResponse } from "next/server"

import { runFollowUpReminders, runStepReminders } from "@/lib/notifications/reminders"
import { createServiceClient } from "@/lib/supabase/admin"

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  const isVercelCron = request.headers.get("x-vercel-cron") === "1"

  const authorized =
    cronSecret &&
    (authHeader === `Bearer ${cronSecret}` || isVercelCron)

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceClient()
  if (!supabase) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY not configured" },
      { status: 500 }
    )
  }

  const followUp = await runFollowUpReminders(supabase)
  const stepReminders = await runStepReminders(supabase)
  return NextResponse.json({ ok: true, ...followUp, ...stepReminders })
}
