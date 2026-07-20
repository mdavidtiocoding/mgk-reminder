import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { FlowConfigTable, type FlowConfigRow } from "@/components/settings/flow-config-table"
import { AppHeader } from "@/components/layout/app-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requireAdmin } from "@/lib/auth/require-admin"
import { STEPS, describeTrigger } from "@/lib/steps"
import { parseSubsteps } from "@/lib/steps/substeps"

type StepDefRow = {
  code: string
  name: string
  division: string
  stage: number
  sort_order: number
  prerequisites: string[] | null
  substeps?: unknown
}

export default async function FlowSettingsPage() {
  const { profile, user, supabase } = await requireAdmin()

  const withSubsteps = await supabase
    .from("step_definitions")
    .select("code, name, division, stage, sort_order, prerequisites, substeps")
    .order("sort_order")

  let stepDefRows: StepDefRow[]

  if (withSubsteps.error) {
    const fallback = await supabase
      .from("step_definitions")
      .select("code, name, division, stage, sort_order, prerequisites")
      .order("sort_order")

    stepDefRows = (fallback.data ?? []).map((row) => ({
      ...row,
      substeps: null,
    })) as StepDefRow[]
  } else {
    stepDefRows = (withSubsteps.data ?? []) as StepDefRow[]
  }

  const unlocksMap = new Map<string, string[]>()
  for (const row of stepDefRows ?? []) {
    for (const prereq of (row.prerequisites as string[] | null) ?? []) {
      const list = unlocksMap.get(prereq) ?? []
      list.push(row.code)
      unlocksMap.set(prereq, list)
    }
  }

  const rows: FlowConfigRow[] = [...(stepDefRows ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((row) => {
      const stepFromLib = STEPS.find((step) => step.code === row.code)
      return {
        code: row.code,
        name: row.name,
        division: row.division,
        stage: row.stage,
        prerequisites: (row.prerequisites as string[] | null) ?? [],
        substeps: parseSubsteps(row.substeps),
        triggerDescription: stepFromLib ? describeTrigger(stepFromLib) : "—",
        unlocksSteps: (unlocksMap.get(row.code) ?? []).sort(
          (a, b) =>
            (STEPS.find((s) => s.code === a)?.order ?? 0) -
            (STEPS.find((s) => s.code === b)?.order ?? 0)
        ),
      }
    })

  const allStepOptions = rows.map((row) => ({
    code: row.code,
    name: row.name,
    stage: row.stage,
  }))

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader
        userName={profile?.name ?? user.email ?? "User"}
        division={profile?.division}
      />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-6">
        <Button variant="ghost" size="sm" className="w-fit" asChild>
          <Link href="/settings">
            <ArrowLeft className="size-4" />
            Kembali ke Settings
          </Link>
        </Button>

        <div>
          <h2 className="text-base font-medium">Konfigurasi Flow Step</h2>
          <p className="text-sm text-muted-foreground">
            Admin only — atur prasyarat (prerequisites) setiap step. Step hanya
            aktif setelah semua prerequisites-nya selesai.
          </p>
        </div>

        <Card className="overflow-visible">
          <CardHeader>
            <CardTitle>Prerequisites per Step</CardTitle>
            <CardDescription>
              Trigger reminder tetap diatur di kode (read-only). Nama step dan
              sub-step bisa diedit di sini. Jalankan{" "}
              <code className="text-xs">database/add-substeps.sql</code>{" "}
              jika kolom sub-step belum ada.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-visible">
            <FlowConfigTable rows={rows} allStepOptions={allStepOptions} />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
