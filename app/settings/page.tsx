import Link from "next/link"
import { GitBranch, ScrollText, Shield } from "lucide-react"
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
import { isDemoLoginMode } from "@/lib/app-login-mode.server"
import { getPermissionContext } from "@/lib/auth/require-permission"
import { isUserSuperAdmin } from "@/lib/auth/user-divisions"
import { getUiTheme } from "@/lib/ui/theme.server"

type SettingsPageProps = {
  searchParams: Promise<{ google?: string; msg?: string }>
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const ctx = await getPermissionContext()
  if (!ctx) redirect("/login")
  if (ctx.profile?.status !== "active") redirect("/pending-approval")

  const { user, profile, userDivisions, permissions, supabase } = ctx
  const { google: googleStatus, msg: googleErrorMsg } = await searchParams

  const headersList = await headers()
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host")
  const proto = headersList.get("x-forwarded-proto") ?? "https"
  const requestUrl = host
    ? new URL(`${proto}://${host}/settings`)
    : new URL("http://localhost:3000/settings")
  const googleRedirectUriHint = resolveGoogleRedirectUri(requestUrl)

  const thresholds = permissions.settings_app_config
    ? await getAppThresholds(supabase)
    : null
  const demoMode = await isDemoLoginMode()
  const theme = demoMode ? await getUiTheme() : null
  const showAdminSection =
    permissions.settings_app_config ||
    permissions.settings_users ||
    permissions.settings_reminders ||
    permissions.settings_demo ||
    permissions.settings_flow ||
    permissions.settings_permissions ||
    permissions.settings_audit

  return (
    <AppShell
      userName={profile?.name ?? user.email ?? "User"}
      division={profile?.division}
      userDivisions={userDivisions}
    >
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
        <h2 className="text-base font-medium">Settings</h2>

        {demoMode && theme && (
          <Card>
            <CardHeader>
              <CardTitle>Tampilan UI</CardTitle>
              <CardDescription>
                Mode Demo — pilih Classic atau Premium. Di Live, Classic
                disembunyikan (selalu Premium).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ThemePicker initialTheme={theme} />
            </CardContent>
          </Card>
        )}

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

        {showAdminSection && (
          <>
            {permissions.settings_permissions && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="size-4" />
                    Akses per role
                  </CardTitle>
                  <CardDescription>
                    Super Admin bisa edit matriks. Admin biasa hanya bisa
                    melihat.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button size="sm" asChild>
                    <Link href="/settings/permissions">
                      {isUserSuperAdmin(userDivisions)
                        ? "Kelola akses role"
                        : "Lihat akses role"}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {permissions.settings_audit && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ScrollText className="size-4" />
                    Audit log
                  </CardTitle>
                  <CardDescription>
                    Siapa yang buat / edit / undo / hapus project dan aksi
                    penting lain.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button size="sm" asChild>
                    <Link href="/settings/audit">Lihat audit log</Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {permissions.settings_app_config && thresholds && (
              <Card>
                <CardHeader>
                  <CardTitle>Konfigurasi</CardTitle>
                  <CardDescription>
                    Threshold waktu respon (default 1×24 jam), warning, dan
                    HOGGER. Deadline per step bisa di-override di Flow Config.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AppConfigForm
                    hoggerDays={thresholds.hoggerDays}
                    warningDays={thresholds.warningDays}
                    delayHours={thresholds.delayHours}
                  />
                </CardContent>
              </Card>
            )}

            {permissions.settings_users && (
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
            )}

            {permissions.settings_reminders && (
              <Card>
                <CardHeader>
                  <CardTitle>Reminder Config</CardTitle>
                  <CardDescription>
                    Atur repeat cadence, max repeat, dan channel notifikasi per
                    step.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button size="sm" asChild>
                    <Link href="/settings/reminders">Kelola Reminder</Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {permissions.settings_demo && (
              <Card>
                <CardHeader>
                  <CardTitle>Demo Task Preview</CardTitle>
                  <CardDescription>
                    Lihat kartu step per divisi (seperti My Tasks), lalu edit
                    checklist / sub-step / trigger langsung — nyambung ke Flow
                    Config.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <Button size="sm" asChild>
                    <Link href="/settings/demo">Buka Demo Preview</Link>
                  </Button>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ["ar", "AR"],
                        ["shipping", "Shipping"],
                        ["project", "Project"],
                        ["finance", "Finance"],
                        ["logistik", "Logistik"],
                        ["marketing", "Marketing"],
                      ] as const
                    ).map(([value, label]) => (
                      <Button key={value} size="sm" variant="outline" asChild>
                        <Link href={`/settings/demo/${value}`}>Demo {label}</Link>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {permissions.settings_flow && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GitBranch className="size-4" />
                    Konfigurasi Flow Step
                  </CardTitle>
                  <CardDescription>
                    Atur prasyarat, checklist, dan trigger reminder (mis. 3 hari
                    sebelum ETA) tanpa coding. Filter per divisi di halaman Flow.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <Button size="sm" asChild>
                    <Link href="/settings/flow">Kelola Flow</Link>
                  </Button>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ["shipping", "Shipping"],
                        ["project", "Project"],
                        ["finance", "Finance"],
                        ["ar", "AR"],
                        ["logistik", "Logistik"],
                        ["marketing", "Marketing"],
                      ] as const
                    ).map(([value, label]) => (
                      <Button key={value} size="sm" variant="outline" asChild>
                        <Link href={`/settings/flow?division=${value}`}>
                          {label}
                        </Link>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </AppShell>
  )
}
