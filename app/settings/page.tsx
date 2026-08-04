import Link from "next/link"
import { GitBranch } from "lucide-react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { updateNotificationPrefs } from "@/app/actions/settings"
import { AppConfigForm } from "@/components/settings/app-config-form"
import { resolveGoogleRedirectUri } from "@/lib/google/env"
import { PushNotificationToggle } from "@/components/notifications/push-toggle"
import { GoogleCalendarConnect } from "@/components/settings/google-calendar-connect"
import { ThemePicker } from "@/components/auth/theme-picker"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { getAppThresholds } from "@/lib/app-config"
import { isUserAdmin, resolveUserDivisions } from "@/lib/auth/user-divisions"
import { getUiTheme } from "@/lib/ui/theme.server"
import { createClient } from "@/lib/supabase/server"

type SettingsPageProps = {
  searchParams: Promise<{ google?: string; msg?: string }>
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, division, divisions, notif_email, notif_push, google_calendar_connected")
    .eq("id", user.id)
    .single()

  const userDivisions = resolveUserDivisions(profile)
  const isAdmin = isUserAdmin(userDivisions)
  const { google: googleStatus, msg: googleErrorMsg } = await searchParams

  const headersList = await headers()
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host")
  const proto = headersList.get("x-forwarded-proto") ?? "https"
  const requestUrl = host
    ? new URL(`${proto}://${host}/settings`)
    : new URL("http://localhost:3000/settings")
  const googleRedirectUriHint = resolveGoogleRedirectUri(requestUrl)

  const thresholds = isAdmin ? await getAppThresholds(supabase) : null
  const theme = await getUiTheme()

  return (
    <AppShell
      userName={profile?.name ?? user.email ?? "User"}
      division={profile?.division}
      userDivisions={userDivisions}
    >
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
        <h2 className="text-base font-medium">Settings</h2>

        <Card>
          <CardHeader>
            <CardTitle>Tampilan UI</CardTitle>
            <CardDescription>
              Pilih Classic (default) atau Premium (preview redesign). Bisa
              diubah kapan saja — logout tidak perlu.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ThemePicker initialTheme={theme} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notifikasi</CardTitle>
            <CardDescription>
              Email via Resend. Push butuh VAPID keys. Google Calendar untuk
              event reminder otomatis di kalender pribadi.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form action={updateNotificationPrefs} className="flex flex-col gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="notif_email"
                  defaultChecked={profile?.notif_email ?? true}
                  className="size-4 rounded border"
                />
                <Label className="font-normal">Email notification</Label>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="notif_push"
                  defaultChecked={profile?.notif_push ?? true}
                  className="size-4 rounded border"
                />
                <Label className="font-normal">Browser push notification</Label>
              </label>
              <Button type="submit" size="sm" className="w-fit">
                Simpan preferensi
              </Button>
            </form>
            <PushNotificationToggle />
            <GoogleCalendarConnect
              connected={profile?.google_calendar_connected ?? false}
              status={googleStatus}
              errorDetail={googleErrorMsg}
              redirectUriHint={googleRedirectUriHint}
            />
          </CardContent>
        </Card>

        {isAdmin && thresholds && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Konfigurasi</CardTitle>
                <CardDescription>
                  Threshold untuk flag HOGGER dan warning &quot;waiting since&quot;
                  di dashboard.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AppConfigForm
                  hoggerDays={thresholds.hoggerDays}
                  warningDays={thresholds.warningDays}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>
                  Kelola user, assign division, dan setujui pendaftar baru.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button size="sm" asChild>
                  <Link href="/settings/users">Kelola Users</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Reminder Config</CardTitle>
                <CardDescription>
                  Admin only — atur repeat cadence, max repeat, dan channel
                  notifikasi per step.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button size="sm" asChild>
                  <Link href="/settings/reminders">Kelola Reminder</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="size-4" />
                  Konfigurasi Flow Step
                </CardTitle>
                <CardDescription>
                  Atur prasyarat (prerequisites) setiap step — step apa yang
                  harus selesai sebelum step ini bisa aktif.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button size="sm" asChild>
                  <Link href="/settings/flow">Kelola Flow</Link>
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </AppShell>
  )
}
