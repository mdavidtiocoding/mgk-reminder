import Link from "next/link"
import { Suspense } from "react"
import { ArrowLeft } from "lucide-react"

import { FlowConfigTable } from "@/components/settings/flow-config-table"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requireAdmin } from "@/lib/auth/require-admin"
import { loadFlowConfigRows } from "@/lib/flow-config/load-rows"
import { getUiTheme } from "@/lib/ui/theme.server"
import { cn } from "@/lib/utils"

export default async function FlowSettingsPage() {
  const { profile, user, userDivisions, supabase } = await requireAdmin()
  const rows = await loadFlowConfigRows(supabase)

  const allStepOptions = rows.map((row) => ({
    code: row.code,
    name: row.name,
    stage: row.stage,
  }))

  const theme = await getUiTheme()
  const isPremium = theme === "premium"

  return (
    <AppShell
      userName={profile?.name ?? user.email ?? "User"}
      division={profile?.division}
      userDivisions={userDivisions}
    >
      <main
        className={cn(
          "flex w-full min-w-0 flex-1 flex-col",
          isPremium ? "gap-3 p-4 lg:p-5" : "gap-6 p-6"
        )}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Button variant="ghost" size="sm" className="w-fit" asChild>
            <Link href="/settings">
              <ArrowLeft className="size-4" />
              Kembali ke Settings
            </Link>
          </Button>
          <div className="min-w-0">
            <h2 className="text-base font-medium">Konfigurasi Flow Step</h2>
            {!isPremium && (
              <p className="text-sm text-muted-foreground">
                Admin — prasyarat, mode selesai, sub-step, nama step.
              </p>
            )}
          </div>
        </div>

        <Card className={cn("overflow-visible", isPremium && "border-0 shadow-none")}>
          {isPremium ? (
            <CardContent className="overflow-visible p-0 pt-1">
              <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Memuat…</p>}>
                <FlowConfigTable
                  rows={rows}
                  allStepOptions={allStepOptions}
                  compact
                />
              </Suspense>
            </CardContent>
          ) : (
            <>
              <CardHeader>
                <CardTitle>Flow per Step</CardTitle>
                <CardDescription>
                  Mode Selesai menentukan form saat &ldquo;Tandai Selesai&rdquo;.
                  Sub-step = tombol berurutan (A1, M3). Trigger (mis. 3 hari
                  sebelum ETA) bisa diedit tanpa coding.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-visible">
                <Suspense fallback={<p className="text-sm text-muted-foreground">Memuat…</p>}>
                  <FlowConfigTable rows={rows} allStepOptions={allStepOptions} />
                </Suspense>
              </CardContent>
            </>
          )}
        </Card>
      </main>
    </AppShell>
  )
}
