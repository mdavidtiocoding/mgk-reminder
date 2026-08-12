import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { ReminderConfigTable } from "@/components/settings/reminder-config-table"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CRON_SCHEDULE_WIB } from "@/lib/constants"
import { requirePermission } from "@/lib/auth/require-permission"
import { getStep } from "@/lib/steps"

export default async function ReminderSettingsPage() {
  const { profile, user, userDivisions, supabase } = await requirePermission("settings_reminders")

  const [{ data: reminderConfigsRaw }, { data: stepDefRows }] = await Promise.all([
    supabase
      .from("reminder_config")
      .select("step_code, enabled, repeat_days, max_repeats, notify_channel"),
    supabase.from("step_definitions").select("code, name"),
  ])

  const nameByCode = new Map(
    (stepDefRows ?? []).map((row) => [row.code, row.name as string])
  )

  const reminderConfigs = [...(reminderConfigsRaw ?? [])]
    .map((config) => ({
      ...config,
      name: nameByCode.get(config.step_code) ?? getStep(config.step_code)?.name ?? config.step_code,
    }))
    .sort(
      (a, b) => (getStep(a.step_code)?.order ?? 0) - (getStep(b.step_code)?.order ?? 0)
    )

  return (
    <AppShell
      userName={profile?.name ?? user.email ?? "User"}
      division={profile?.division}
      userDivisions={userDivisions}
    >
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-6">
        <Button variant="ghost" size="sm" className="w-fit" asChild>
          <Link href="/settings">
            <ArrowLeft className="size-4" />
            Kembali ke Settings
          </Link>
        </Button>

        <div>
          <h2 className="text-base font-medium">Reminder Config</h2>
          <p className="text-sm text-muted-foreground">
            Admin only — atur repeat cadence, max repeat, dan channel
            notifikasi per step.
          </p>
        </div>

        <Card className="overflow-visible">
          <CardHeader>
            <CardTitle>Konfigurasi per Step</CardTitle>
            <CardDescription>
              Saat step unlock: notif + kalender langsung. Di sini atur repeat
              tiap N hari, max repeat, dan channel. Step &amp; follow-up reminder
              dicek tiap ~2 jam, hogger check harian pukul{" "}
              {CRON_SCHEDULE_WIB}. Perubahan tersimpan otomatis.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-visible">
            <ReminderConfigTable configs={reminderConfigs} />
          </CardContent>
        </Card>
      </main>
    </AppShell>
  )
}
