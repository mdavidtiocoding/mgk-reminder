import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { DemoTaskPreview } from "@/components/settings/demo-task-preview"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { requireAdmin } from "@/lib/auth/require-admin"
import { loadFlowConfigRows } from "@/lib/flow-config/load-rows"
import {
  DIVISION_LABELS,
  type Division,
} from "@/lib/steps"

const VALID: Division[] = [
  "marketing",
  "ar",
  "logistik",
  "finance",
  "shipping",
  "project",
]

export default async function DemoDivisionPreviewPage({
  params,
}: {
  params: Promise<{ division: string }>
}) {
  const { division: raw } = await params
  const division = raw as Division
  if (!VALID.includes(division)) {
    notFound()
  }

  const { profile, user, userDivisions, supabase } = await requireAdmin()
  const allRows = await loadFlowConfigRows(supabase)
  const rows = allRows.filter((row) => row.division === division)

  return (
    <AppShell
      userName={profile?.name ?? user.email ?? "User"}
      division={profile?.division}
      userDivisions={userDivisions}
    >
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
        <Button variant="ghost" size="sm" className="w-fit" asChild>
          <Link href="/settings">
            <ArrowLeft className="size-4" />
            Kembali ke Settings
          </Link>
        </Button>

        <div>
          <h2 className="text-base font-medium">
            Demo Preview — {DIVISION_LABELS[division]}
          </h2>
          <p className="text-sm text-muted-foreground">
            {rows.length} step divisi {DIVISION_LABELS[division]}. Edit
            konfigurasi langsung dari kartu (nyambung ke Flow Config).
          </p>
        </div>

        <DemoTaskPreview
          division={division}
          rows={rows}
          allRows={allRows}
        />
      </main>
    </AppShell>
  )
}
