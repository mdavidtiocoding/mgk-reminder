"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, GitBranch, Pencil, Table2 } from "lucide-react"

import { saveFlowStepDraft } from "@/lib/flow-config/save-draft"
import {
  DependencyDisplay,
  SubstepDisplay,
  TriggerDisplay,
  UnlockDisplay,
  buildNameLookup,
} from "@/components/settings/flow-config/display-cells"
import {
  type FlowPageMode,
  type FlowStepDraft,
} from "@/components/settings/flow-config/flow-step-drawer-types"
import { FlowStepEditDrawer } from "@/components/settings/flow-config/flow-step-edit-drawer"
import { FlowGraphView } from "@/components/settings/flow-config/flow-graph-view"
import { FlowConfigLegend } from "@/components/settings/flow-config/legend"
import { FlowValidationBanner } from "@/components/settings/flow-config/validation-banner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DIVISION_BADGE_STYLES,
  DIVISION_LABELS,
  STAGE_LABELS,
  type Division,
  getDivisionLabel,
  getStep,
} from "@/lib/steps"
import type { SubstepDefinition } from "@/lib/steps/substeps"
import {
  COMPLETION_MODE_BADGES,
  COMPLETION_MODE_LABELS,
  type StepCompletionMode,
} from "@/lib/steps/completion-mode"
import { cn } from "@/lib/utils"

export type FlowConfigRow = {
  code: string
  name: string
  division: string
  stage: number
  prerequisites: string[]
  substeps: SubstepDefinition[]
  completionMode: StepCompletionMode
  checklistItems: string[]
  triggerDescription: string
  unlocksSteps: string[]
  trigger?: import("@/lib/steps").StepTrigger
  /** Ask BAST 1 only vs BAST 1+2 on mark done (typically P8). */
  bastChoice: boolean
  /** Ask Ada/Tidak and forward notes to a chosen next step. */
  noteRoute: import("@/lib/steps/note-route-config").NoteRouteConfig
  /** Step reschedule: ask Selesai / Belum and pick the next date. */
  hasOutcome: boolean
  outcomeRescheduleField: import("@/lib/steps").DateField | null
}

type AllStepOption = {
  code: string
  name: string
  stage: number
}

type SortOption =
  | "flow"
  | "code-asc"
  | "code-desc"
  | "name-asc"
  | "stage-asc"
  | "stage-desc"
  | "division-asc"

type LayoutViewMode = "table" | "flow"

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "flow", label: "Urutan flow" },
  { value: "code-asc", label: "Code (A \u2192 Z)" },
  { value: "code-desc", label: "Code (Z \u2192 A)" },
  { value: "name-asc", label: "Nama (A \u2192 Z)" },
  { value: "stage-asc", label: "Tahap (1 \u2192 8)" },
  { value: "stage-desc", label: "Tahap (8 \u2192 1)" },
  { value: "division-asc", label: "Divisi (A \u2192 Z)" },
]
function compareStepCodes(a: string, b: string) {
  const parse = (code: string) => {
    const match = code.match(/^([A-Za-z]+)(\d+)$/)
    if (!match) return { prefix: code, num: 0 }
    return { prefix: match[1].toUpperCase(), num: Number.parseInt(match[2], 10) }
  }
  const left = parse(a)
  const right = parse(b)
  if (left.prefix !== right.prefix) {
    return left.prefix.localeCompare(right.prefix)
  }
  return left.num - right.num
}

function sortRows(rows: FlowConfigRow[], sort: SortOption): FlowConfigRow[] {
  const sorted = [...rows]
  switch (sort) {
    case "code-asc":
      return sorted.sort((a, b) => compareStepCodes(a.code, b.code))
    case "code-desc":
      return sorted.sort((a, b) => compareStepCodes(b.code, a.code))
    case "name-asc":
      return sorted.sort((a, b) => a.name.localeCompare(b.name, "id"))
    case "stage-asc":
      return sorted.sort((a, b) => {
        if (a.stage !== b.stage) return a.stage - b.stage
        return compareStepCodes(a.code, b.code)
      })
    case "stage-desc":
      return sorted.sort((a, b) => {
        if (a.stage !== b.stage) return b.stage - a.stage
        return compareStepCodes(a.code, b.code)
      })
    case "division-asc":
      return sorted.sort((a, b) => {
        const divCompare = getDivisionLabel(a.division as Division).localeCompare(
          getDivisionLabel(b.division as Division),
          "id"
        )
        if (divCompare !== 0) return divCompare
        return compareStepCodes(a.code, b.code)
      })
    case "flow":
    default:
      return sorted.sort(
        (a, b) =>
          (getStep(a.code)?.order ?? Number.MAX_SAFE_INTEGER) -
          (getStep(b.code)?.order ?? Number.MAX_SAFE_INTEGER)
      )
  }
}

export function FlowConfigTable({
  rows,
  allStepOptions,
  compact = false,
}: {
  rows: FlowConfigRow[]
  allStepOptions: AllStepOption[]
  compact?: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialDivision = searchParams.get("division") ?? "all"
  const [search, setSearch] = useState("")
  const [stageFilter, setStageFilter] = useState("all")
  const [divisionFilter, setDivisionFilter] = useState(initialDivision)
  const [sort, setSort] = useState<SortOption>("flow")
  const [layoutView, setLayoutView] = useState<LayoutViewMode>("table")
  const [pageMode, setPageMode] = useState<FlowPageMode>("view")
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [nameOverrides, setNameOverrides] = useState<Record<string, string>>({})
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const fromUrl = searchParams.get("division")
    if (fromUrl) setDivisionFilter(fromUrl)
  }, [searchParams])

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [])  

  function showToast(message: string) {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2200)
  }

  const nameByCode = useMemo(
    () =>
      new Map(
        rows.map((row) => [row.code, nameOverrides[row.code] ?? row.name])
      ),
    [rows, nameOverrides]
  )

  const nameLookup = useMemo(
    () =>
      buildNameLookup(
        rows.map((row) => ({
          code: row.code,
          name: nameByCode.get(row.code) ?? row.name,
        }))
      ),
    [rows, nameByCode]
  )

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = rows.filter((row) => {
      if (stageFilter !== "all" && row.stage !== Number.parseInt(stageFilter, 10)) {
        return false
      }
      if (divisionFilter !== "all" && row.division !== divisionFilter) {
        return false
      }
      if (!q) return true
      const divisionLabel = getDivisionLabel(row.division as Division).toLowerCase()
      const stageLabel = (STAGE_LABELS[row.stage] ?? "").toLowerCase()
      return (
        row.code.toLowerCase().includes(q) ||
        row.name.toLowerCase().includes(q) ||
        row.division.toLowerCase().includes(q) ||
        divisionLabel.includes(q) ||
        stageLabel.includes(q) ||
        String(row.stage).includes(q)
      )
    })
    return sortRows(filtered, sort)
  }, [rows, search, stageFilter, divisionFilter, sort])

  const groupByStage = sort === "flow" || sort === "stage-asc"

  const tableBodyItems = useMemo(() => {
    if (!groupByStage) {
      return filteredRows.map((row) => ({ type: "row" as const, row }))
    }
    const items: Array<
      { type: "stage"; stage: number } | { type: "row"; row: FlowConfigRow }
    > = []
    let lastStage: number | null = null
    for (const row of filteredRows) {
      if (row.stage !== lastStage) {
        items.push({ type: "stage", stage: row.stage })
        lastStage = row.stage
      }
      items.push({ type: "row", row })
    }
    return items
  }, [filteredRows, groupByStage])

  const selectedRow = selectedCode
    ? rows.find((row) => row.code === selectedCode) ?? null
    : null

  const drawerIsEdit = pageMode === "edit"

  function openRow(code: string) {
    if (pageMode !== "edit") return
    setSelectedCode(code)
  }

  function closeDrawer() {
    setSelectedCode(null)
  }

  function handlePageModeChange(mode: FlowPageMode) {
    setPageMode(mode)
    if (mode === "view") {
      closeDrawer()
    }
  }
  const hasActiveFilters =
    search.trim() !== "" || stageFilter !== "all" || divisionFilter !== "all"

  async function handleSaveStep(
    stepCode: string,
    draft: FlowStepDraft,
    original: FlowStepDraft
  ) {
    const result = await saveFlowStepDraft(stepCode, draft, original)
    if (!result.success) {
      showToast(`Gagal: ${result.error}`)
      return { success: false, error: result.error }
    }
    if (draft.name.trim() !== original.name) {
      setNameOverrides((prev) => ({ ...prev, [stepCode]: draft.name.trim() }))
    }
    showToast("Perubahan tersimpan")
    router.refresh()
    return { success: true }
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Belum ada step definitions.</p>
    )
  }

  return (
    <>
      <div className={cn("mb-3 flex flex-col gap-3", compact && "mb-2 gap-2")}>
        <FlowConfigLegend compact={compact} />
        <FlowValidationBanner rows={rows} />
      </div>

      <div
        className={cn(
          "mb-3 flex flex-wrap items-center gap-2",
          compact && "mb-2 gap-1.5"
        )}
      >
        <div className="flex rounded-lg border p-0.5">
          <Button
            type="button"
            variant={pageMode === "view" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => handlePageModeChange("view")}
          >
            <Eye className="size-3.5" />
            View
          </Button>
          <Button
            type="button"
            variant={pageMode === "edit" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => handlePageModeChange("edit")}
          >
            <Pencil className="size-3.5" />
            Edit
          </Button>
        </div>

        <div className="flex rounded-lg border p-0.5">
          <Button
            type="button"
            variant={layoutView === "table" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => setLayoutView("table")}
          >
            <Table2 className="size-3.5" />
            Tabel
          </Button>
          <Button
            type="button"
            variant={layoutView === "flow" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => setLayoutView("flow")}
          >
            <GitBranch className="size-3.5" />
            Flow
          </Button>
        </div>

        <Input
          type="search"
          placeholder="Cari code, nama, divisi, tahap\u2026"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={cn("max-w-sm", compact && "h-8 max-w-xs text-sm")}
        />

        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className={cn("w-[200px]", compact && "h-8 w-[160px] text-xs")} size="sm">
            <SelectValue placeholder="Tahap" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua tahap</SelectItem>
            {Object.entries(STAGE_LABELS).map(([stage, label]) => (
              <SelectItem key={stage} value={stage}>
                Tahap {stage}: {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={divisionFilter} onValueChange={setDivisionFilter}>
          <SelectTrigger className={cn("w-[180px]", compact && "h-8 w-[140px] text-xs")} size="sm">
            <SelectValue placeholder="Divisi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua divisi</SelectItem>
            {(Object.entries(DIVISION_LABELS) as [Division, string][])
              .filter(([division]) => division !== "admin")
              .map(([division, label]) => (
                <SelectItem key={division} value={division}>
                  {label}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(value) => setSort(value as SortOption)}>
          <SelectTrigger className={cn("w-[180px]", compact && "h-8 w-[140px] text-xs")} size="sm">
            <SelectValue placeholder="Urutkan" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div
        className={cn(
          "mb-3 rounded-lg border px-3 py-2 text-xs",
          pageMode === "view"
            ? "border-muted bg-muted/30 text-muted-foreground"
            : "border-primary/25 bg-primary/5 text-foreground"
        )}
      >
        {pageMode === "view" ? (
          <span>
            <Eye className="mr-1.5 inline size-3.5 align-text-bottom" />
            <strong>Mode lihat</strong> — tabel read-only, baris tidak bisa diklik. Switch ke{" "}
            <strong>Edit</strong> untuk ubah step.
          </span>
        ) : (
          <span>
            <Pencil className="mr-1.5 inline size-3.5 align-text-bottom text-primary" />
            <strong>Mode edit</strong> — klik baris langsung buka panel edit & simpan
            perubahan.
          </span>
        )}
      </div>

      {(hasActiveFilters || sort !== "flow") && (
        <p className="mb-3 text-xs text-muted-foreground">
          Menampilkan {filteredRows.length} dari {rows.length} step
        </p>
      )}

      {layoutView === "flow" ? (
        <FlowGraphView
          rows={filteredRows}
          nameByCode={nameByCode}
          pageMode={pageMode}
          onOpenNode={openRow}
          compact={compact}
        />
      ) : (
        <div
          className={cn(
            "rounded-lg border",
            pageMode === "edit" && "border-primary/20",
            compact && "rounded-md"
          )}
        >
          <table className={cn("w-full table-auto text-sm", compact && "text-xs")}>
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className={cn("px-3 py-2 font-medium whitespace-nowrap", compact && "px-2 py-1.5")}>Code</th>
                <th className={cn("px-3 py-2 font-medium min-w-[12rem]", compact && "px-2 py-1.5")}>Nama Step</th>
                <th className={cn("px-3 py-2 font-medium whitespace-nowrap", compact && "px-2 py-1.5")}>Divisi</th>
                <th className={cn("px-3 py-2 font-medium whitespace-nowrap", compact && "px-2 py-1.5")}>Tahap</th>
                <th className={cn("px-3 py-2 font-medium whitespace-nowrap", compact && "px-2 py-1.5")}>Mode</th>
                <th className={cn("px-3 py-2 font-medium min-w-[10rem]", compact && "px-2 py-1.5")}>Prasyarat</th>
                <th className={cn("px-3 py-2 font-medium min-w-[8rem]", compact && "px-2 py-1.5")}>Memicu</th>
                <th className={cn("px-3 py-2 font-medium min-w-[8rem]", compact && "px-2 py-1.5")}>Sub-step</th>
                <th className={cn("px-3 py-2 font-medium min-w-[10rem]", compact && "px-2 py-1.5")}>
                  Trigger
                </th>
                {pageMode === "edit" && (
                  <th className={cn("px-3 py-2 font-medium w-10", compact && "px-2 py-1.5")} aria-label="Edit" />
                )}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={pageMode === "edit" ? 10 : 9} className="px-3 py-6 text-center text-muted-foreground">
                    Tidak ada step yang cocok dengan filter atau pencarian.
                  </td>
                </tr>
              ) : (
                tableBodyItems.map((item, index) =>
                  item.type === "stage" ? (
                    <tr key={`stage-${item.stage}`} className="bg-muted/30">
                      <td
                        colSpan={pageMode === "edit" ? 10 : 9}
                        className={cn(
                          "px-3 py-2 text-xs font-semibold uppercase tracking-wide",
                          compact && "px-2 py-1.5"
                        )}
                      >
                        Tahap {item.stage}
                        {STAGE_LABELS[item.stage]
                          ? `\u2014 ${STAGE_LABELS[item.stage]}`
                          : ""}
                      </td>
                    </tr>
                  ) : (
                    <FlowConfigTableRow
                      key={item.row.code}
                      row={item.row}
                      displayName={nameByCode.get(item.row.code) ?? item.row.name}
                      nameLookup={nameLookup}
                      compact={compact}
                      onOpen={
                        pageMode === "edit" ? () => openRow(item.row.code) : undefined
                      }
                      pageMode={pageMode}
                    />
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      )}

      {selectedRow && drawerIsEdit && (
        <FlowStepEditDrawer
          row={selectedRow}
          displayName={nameByCode.get(selectedRow.code) ?? selectedRow.name}
          allStepOptions={allStepOptions}
          open
          onOpenChange={(open) => {
            if (!open) closeDrawer()
          }}
          handlers={{
            onSave: handleSaveStep,
            onDuplicateSuccess: () => router.refresh(),
            onResetSuccess: () => router.refresh(),
          }}
          onSaved={() => {
            closeDrawer()
          }}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed right-6 bottom-6 z-50 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg"
        >
          {toast}
        </div>
      )}
    </>
  )
}

function FlowConfigTableRow({
  row,
  displayName,
  nameLookup,
  compact = false,
  pageMode,
  onOpen,
}: {
  row: FlowConfigRow
  displayName: string
  nameLookup: Map<string, string>
  compact?: boolean
  pageMode: FlowPageMode
  onOpen?: () => void
}) {
  const division = row.division as Division
  const badgeStyle = DIVISION_BADGE_STYLES[division]
  const cell = compact ? "px-2 py-1.5" : "px-3 py-2"
  const stepDef = getStep(row.code)
  const isInteractive = pageMode === "edit" && !!onOpen

  return (
    <tr
      className={cn(
        "border-b align-top last:border-b-0",
        isInteractive && "cursor-pointer transition-colors hover:bg-primary/5"
      )}
      onClick={isInteractive ? onOpen : undefined}
      title={isInteractive ? "Klik untuk edit step" : undefined}
    >
      <td className={cn(cell, "font-mono text-xs")}>{row.code}</td>
      <td className={cn(cell, "font-medium leading-snug")}>
        <span className="inline-flex flex-wrap items-center gap-1.5">
          {displayName}
          {row.bastChoice && (
            <span className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
              BAST choice
            </span>
          )}
          {row.noteRoute?.enabled && (
            <span className="rounded-md border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-900">
              Ada/Tidak
            </span>
          )}
          {row.hasOutcome && (
            <span className="rounded-md border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[10px] font-semibold text-orange-900">
              Reschedule
            </span>
          )}
        </span>
      </td>
      <td className={cell}>
        {badgeStyle ? (
          <span
            className={cn(
              "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap",
              badgeStyle.badge
            )}
          >
            {getDivisionLabel(division)}
          </span>
        ) : (
          row.division
        )}
      </td>
      <td className={cn(cell, "text-xs")}>
        <span className="font-medium">{row.stage}</span>
      </td>
      <td className={cell}>
        {row.substeps.length > 0 ? (
          <span
            className={cn(
              "inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold",
              COMPLETION_MODE_BADGES.normal
            )}
          >
            Sub-step
          </span>
        ) : (
          <span
            className={cn(
              "inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold",
              COMPLETION_MODE_BADGES[row.completionMode]
            )}
          >
            {COMPLETION_MODE_LABELS[row.completionMode]}
          </span>
        )}
      </td>
      <td className={cell}>
        <DependencyDisplay codes={row.prerequisites} names={nameLookup} />
      </td>
      <td className={cell}>
        <UnlockDisplay codes={row.unlocksSteps} names={nameLookup} />
      </td>
      <td className={cell}>
        <SubstepDisplay substeps={row.substeps} />
      </td>
      <td className={cn(cell, compact ? "text-xs" : "")}>
        <TriggerDisplay stepDef={stepDef} />
      </td>
      {pageMode === "edit" && (
        <td className={cn(cell, "text-muted-foreground")}>
          <Pencil className="size-3.5 opacity-40" aria-hidden />
        </td>
      )}
    </tr>
  )
}
