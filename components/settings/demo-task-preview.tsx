"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { Pencil, ListChecks, Layers, Zap } from "lucide-react"

import { saveFlowStepDraft } from "@/lib/flow-config/save-draft"
import { FlowStepEditDrawer } from "@/components/settings/flow-config/flow-step-edit-drawer"
import type { FlowConfigRow } from "@/components/settings/flow-config-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DIVISION_BADGE_STYLES,
  DIVISION_LABELS,
  STAGE_LABELS,
  type Division,
  getDivisionLabel,
} from "@/lib/steps"
import {
  COMPLETION_MODE_BADGES,
  COMPLETION_MODE_LABELS,
} from "@/lib/steps/completion-mode"
import { cn } from "@/lib/utils"

const DEMO_DIVISIONS = [
  "marketing",
  "ar",
  "logistik",
  "finance",
  "shipping",
  "project",
] as const satisfies readonly Division[]

export function DemoTaskPreview({
  division,
  rows,
  allRows,
}: {
  division: Division
  rows: FlowConfigRow[]
  allRows: FlowConfigRow[]
}) {
  const router = useRouter()
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const selectedRow = useMemo(
    () => allRows.find((r) => r.code === selectedCode) ?? null,
    [allRows, selectedCode]
  )

  const allStepOptions = useMemo(
    () =>
      allRows.map((row) => ({
        code: row.code,
        name: row.name,
        stage: row.stage,
      })),
    [allRows]
  )

  const divisionStyle = DIVISION_BADGE_STYLES[division]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {DEMO_DIVISIONS.map((d) => (
          <Button
            key={d}
            size="sm"
            variant={d === division ? "default" : "outline"}
            asChild
          >
            <Link href={`/settings/demo/${d}`}>{DIVISION_LABELS[d]}</Link>
          </Button>
        ))}
      </div>

      <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        Preview seperti <span className="font-medium text-foreground">My Tasks</span>{" "}
        untuk divisi{" "}
        <span
          className={cn(
            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
            divisionStyle.badge
          )}
        >
          {getDivisionLabel(division)}
        </span>
        . Klik <span className="font-medium text-foreground">Edit konfigurasi</span>{" "}
        untuk ubah checklist, sub-step, mode selesai, atau trigger — langsung tersimpan
        ke Flow Config.
      </div>

      {toast && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {toast}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Belum ada step untuk divisi ini.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((row) => (
            <DemoTaskCard
              key={row.code}
              row={row}
              onEdit={() => setSelectedCode(row.code)}
            />
          ))}
        </div>
      )}

      <FlowStepEditDrawer
        row={selectedRow}
        displayName={selectedRow?.name ?? ""}
        allStepOptions={allStepOptions}
        open={!!selectedRow}
        onOpenChange={(open) => {
          if (!open) setSelectedCode(null)
        }}
        handlers={{
          onSave: async (stepCode, draft, original) => {
            const result = await saveFlowStepDraft(stepCode, draft, original)
            if (!result.success) {
              setToast(`Gagal: ${result.error}`)
              return false
            }
            setToast("Konfigurasi tersimpan — preview diperbarui.")
            router.refresh()
            return true
          },
        }}
      />
    </div>
  )
}

function DemoTaskCard({
  row,
  onEdit,
}: {
  row: FlowConfigRow
  onEdit: () => void
}) {
  const hasChecklist = row.checklistItems.length > 0
  const hasSubsteps = row.substeps.length > 0

  return (
    <Card className={cn("border-l-4", DIVISION_BADGE_STYLES[row.division as Division]?.border)}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono text-[10px]">
                {row.code}
              </Badge>
              <Badge
                className={cn(
                  "text-[10px]",
                  COMPLETION_MODE_BADGES[row.completionMode]
                )}
              >
                {COMPLETION_MODE_LABELS[row.completionMode]}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Tahap {row.stage} — {STAGE_LABELS[row.stage] ?? ""}
              </span>
            </div>
            <CardTitle className="text-base leading-snug">{row.name}</CardTitle>
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <Zap className="size-3 shrink-0" aria-hidden />
              {row.triggerDescription}
            </CardDescription>
          </div>
          <Button size="sm" onClick={onEdit}>
            <Pencil className="size-3.5" />
            Edit konfigurasi
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0">
        {hasChecklist && (
          <div className="rounded-lg border bg-background p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium">
              <ListChecks className="size-3.5" aria-hidden />
              Checklist ({row.checklistItems.length})
            </p>
            <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
              {row.checklistItems.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {hasSubsteps && (
          <div className="rounded-lg border bg-background p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium">
              <Layers className="size-3.5" aria-hidden />
              Sub-step ({row.substeps.length})
            </p>
            <ol className="flex flex-col gap-1 text-sm text-muted-foreground">
              {row.substeps.map((s, i) => (
                <li key={s.key}>
                  {i + 1}. {s.label}
                  <span className="ml-1 text-[10px] uppercase tracking-wide opacity-70">
                    ({s.kind ?? "required"})
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {!hasChecklist && !hasSubsteps && (
          <p className="text-xs text-muted-foreground">
            Belum ada checklist / sub-step — edit untuk menambah (mis. multiple
            sub-step atau checklist).
          </p>
        )}

        {row.prerequisites.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Prasyarat:{" "}
            <span className="font-medium text-foreground">
              {row.prerequisites.join(", ")}
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  )
}
