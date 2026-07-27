import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { FlowConfigTable, type FlowConfigRow } from "@/components/settings/flow-config-table"
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
import { STEPS, describeTrigger } from "@/lib/steps"
import { inferCompletionMode } from "@/lib/steps/completion-mode"
import { parseSubsteps } from "@/lib/steps/substeps"
import { getUiTheme } from "@/lib/ui/theme.server"
import { cn } from "@/lib/utils"

type StepDefRow = {
  code: string
  name: string
  division: string
  stage: number
  sort_order: number
  prerequisites: string[] | null
  checklist_items?: string[] | null
  completion_mode?: string | null
  substeps?: unknown
}

export default async function FlowSettingsPage() {
  const { profile, user, supabase } = await requireAdmin()

  const fullQuery = await supabase
    .from("step_definitions")
    .select(
      "code, name, division, stage, sort_order, prerequisites, checklist_items, completion_mode, substeps"
    )
    .order("sort_order")

  let stepDefRows: StepDefRow[]

  if (fullQuery.error) {
    const withSubsteps = await supabase
      .from("step_definitions")
      .select(
        "code, name, division, stage, sort_order, prerequisites, checklist_items, substeps"
      )
      .order("sort_order")

    if (withSubsteps.error) {
      const fallback = await supabase
        .from("step_definitions")
        .select("code, name, division, stage, sort_order, prerequisites, checklist_items")
        .order("sort_order")

      stepDefRows = (fallback.data ?? []).map((row) => ({
        ...row,
        substeps: null,
        completion_mode: null,
      })) as StepDefRow[]
    } else {
      stepDefRows = (withSubsteps.data ?? []).map((row) => ({
        ...row,
        completion_mode: null,
      })) as StepDefRow[]
    }
  } else {
    stepDefRows = (fullQuery.data ?? []) as StepDefRow[]
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
      const checklistItems =
        (row.checklist_items as string[] | null) ?? stepFromLib?.checklist ?? []
      return {
        code: row.code,
        name: row.name,
        division: row.division,
        stage: row.stage,
        prerequisites: (row.prerequisites as string[] | null) ?? [],
        substeps: parseSubsteps(row.substeps),
        completionMode: inferCompletionMode(
          checklistItems,
          row.completion_mode ?? null
        ),
        checklistItems,
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

  const theme = await getUiTheme()
  const isPremium = theme === "premium"

  return (
    <AppShell
      userName={profile?.name ?? user.email ?? "User"}
      division={profile?.division}
    >
      <main
        className={cn(
          "flex w-full min-w-0 flex-1 flex-col",
          isPremium ? "gap-3 p-4 lg:p-5" : "gap-6 p-6"
        )}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Button variant="ghost" size="sm" className="-ml-2 h-8 w-fit px-2" asChild>
            <Link href="/settings">
              <ArrowLeft className="size-4" />
              Settings
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
              <FlowConfigTable
                rows={rows}
                allStepOptions={allStepOptions}
                compact
              />
            </CardContent>
          ) : (
            <>
              <CardHeader>
                <CardTitle>Flow per Step</CardTitle>
                <CardDescription>
                  Mode Selesai menentukan form saat &ldquo;Tandai Selesai&rdquo;.
                  Sub-step = tombol berurutan (A1, M3).
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-visible">
                <FlowConfigTable rows={rows} allStepOptions={allStepOptions} />
              </CardContent>
            </>
          )}
        </Card>
      </main>
    </AppShell>
  )
}
