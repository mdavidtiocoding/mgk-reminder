"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil } from "lucide-react"

import { updateStepPrerequisites, updateStepUnlocks, updateStepSubsteps } from "@/app/actions/flow-config"
import { updateStepDefinitionName } from "@/app/actions/settings"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { slugifySubstepKey, type SubstepDefinition } from "@/lib/steps/substeps"
import { cn } from "@/lib/utils"

export type FlowConfigRow = {
  code: string
  name: string
  division: string
  stage: number
  prerequisites: string[]
  substeps: SubstepDefinition[]
  triggerDescription: string
  unlocksSteps: string[]
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

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "flow", label: "Urutan flow" },
  { value: "code-asc", label: "Code (A → Z)" },
  { value: "code-desc", label: "Code (Z → A)" },
  { value: "name-asc", label: "Nama (A → Z)" },
  { value: "stage-asc", label: "Tahap (1 → 8)" },
  { value: "stage-desc", label: "Tahap (8 → 1)" },
  { value: "division-asc", label: "Divisi (A → Z)" },
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
}: {
  rows: FlowConfigRow[]
  allStepOptions: AllStepOption[]
}) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [stageFilter, setStageFilter] = useState("all")
  const [divisionFilter, setDivisionFilter] = useState("all")
  const [sort, setSort] = useState<SortOption>("flow")
  const [toast, setToast] = useState<string | null>(null)
  const [nameOverrides, setNameOverrides] = useState<Record<string, string>>({})
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const hasActiveFilters =
    search.trim() !== "" || stageFilter !== "all" || divisionFilter !== "all"

  async function handleRename(stepCode: string, name: string) {
    const result = await updateStepDefinitionName(stepCode, name)
    if (result?.success) {
      setNameOverrides((prev) => ({ ...prev, [stepCode]: name }))
      showToast("Nama tersimpan")
      router.refresh()
    } else {
      showToast(result?.error ? `Gagal: ${result.error}` : "Gagal menyimpan")
    }
    return result?.success ?? false
  }

  async function handlePrerequisitesSave(stepCode: string, prerequisites: string[]) {
    const result = await updateStepPrerequisites(stepCode, prerequisites)
    if (result.success) {
      showToast("Prerequisites tersimpan")
      router.refresh()
    } else {
      showToast(`Gagal: ${result.error}`)
    }
    return result.success
  }

  async function handleUnlocksSave(sourceStepCode: string, unlocksSteps: string[]) {
    const result = await updateStepUnlocks(sourceStepCode, unlocksSteps)
    if (result.success) {
      showToast("Memicu step tersimpan")
      router.refresh()
    } else {
      showToast(`Gagal: ${result.error}`)
    }
    return result.success
  }

  async function handleSubstepsSave(
    stepCode: string,
    substeps: SubstepDefinition[]
  ) {
    const result = await updateStepSubsteps(stepCode, substeps)
    if (result.success) {
      showToast("Sub-step tersimpan")
      router.refresh()
    } else {
      showToast(`Gagal: ${result.error}`)
    }
    return result.success
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Belum ada step definitions.</p>
    )
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          type="search"
          placeholder="Cari code, nama, divisi, atau tahap…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />

        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[200px]" size="sm">
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
          <SelectTrigger className="w-[180px]" size="sm">
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
          <SelectTrigger className="w-[180px]" size="sm">
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

      {(hasActiveFilters || sort !== "flow") && (
        <p className="mb-3 text-xs text-muted-foreground">
          Menampilkan {filteredRows.length} dari {rows.length} step
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th className="px-3 py-2 font-medium">Code</th>
              <th className="px-3 py-2 font-medium">Nama Step</th>
              <th className="px-3 py-2 font-medium">Divisi</th>
              <th className="px-3 py-2 font-medium">Tahap</th>
              <th className="px-3 py-2 font-medium">Prerequisites (harus selesai dulu)</th>
              <th className="px-3 py-2 font-medium">Memicu Step</th>
              <th className="px-3 py-2 font-medium">Sub-step</th>
              <th className="px-3 py-2 font-medium">Trigger Reminder</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                  Tidak ada step yang cocok dengan filter atau pencarian.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <FlowConfigTableRow
                  key={row.code}
                  row={row}
                  displayName={nameByCode.get(row.code) ?? row.name}
                  allStepOptions={allStepOptions}
                  onRename={handleRename}
                  onPrerequisitesSave={handlePrerequisitesSave}
                  onUnlocksSave={handleUnlocksSave}
                  onSubstepsSave={handleSubstepsSave}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

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
  allStepOptions,
  onRename,
  onPrerequisitesSave,
  onUnlocksSave,
  onSubstepsSave,
}: {
  row: FlowConfigRow
  displayName: string
  allStepOptions: AllStepOption[]
  onRename: (stepCode: string, name: string) => Promise<boolean>
  onPrerequisitesSave: (stepCode: string, prerequisites: string[]) => Promise<boolean>
  onUnlocksSave: (sourceStepCode: string, unlocksSteps: string[]) => Promise<boolean>
  onSubstepsSave: (stepCode: string, substeps: SubstepDefinition[]) => Promise<boolean>
}) {
  const division = row.division as Division
  const badgeStyle = DIVISION_BADGE_STYLES[division]

  return (
    <tr className="border-b align-top last:border-b-0">
      <td className="px-3 py-2 font-mono text-xs">{row.code}</td>
      <td className="px-3 py-2">
        <StepNameCell stepCode={row.code} name={displayName} onRename={onRename} />
      </td>
      <td className="px-3 py-2">
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
      <td className="px-3 py-2 text-xs">
        <span className="font-medium">{row.stage}</span>
        {STAGE_LABELS[row.stage] && (
          <p className="text-muted-foreground">{STAGE_LABELS[row.stage]}</p>
        )}
      </td>
      <td className="px-3 py-2">
        <PrerequisitesCell
          stepCode={row.code}
          prerequisites={row.prerequisites}
          allStepOptions={allStepOptions}
          onSave={onPrerequisitesSave}
        />
      </td>
      <td className="px-3 py-2">
        <UnlocksStepsCell
          stepCode={row.code}
          unlocksSteps={row.unlocksSteps}
          allStepOptions={allStepOptions}
          onSave={onUnlocksSave}
        />
      </td>
      <td className="px-3 py-2">
        <SubstepsCell
          stepCode={row.code}
          substeps={row.substeps}
          onSave={onSubstepsSave}
        />
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground italic">
        {row.triggerDescription}
      </td>
    </tr>
  )
}

function UnlocksStepsCell({
  stepCode,
  unlocksSteps,
  allStepOptions,
  onSave,
}: {
  stepCode: string
  unlocksSteps: string[]
  allStepOptions: AllStepOption[]
  onSave: (sourceStepCode: string, unlocksSteps: string[]) => Promise<boolean>
}) {
  return (
    <StepCodesPickerCell
      stepCode={stepCode}
      selectedCodes={unlocksSteps}
      allStepOptions={allStepOptions}
      badgeVariant="secondary"
      editLabel={`Edit memicu step ${stepCode}`}
      dialogTitle={`Memicu Step — ${stepCode}`}
      dialogDescription={`Pilih step yang akan aktif setelah ${stepCode} selesai (menambah ${stepCode} ke prerequisites step tersebut).`}
      onSave={(codes) => onSave(stepCode, codes)}
    />
  )
}

function PrerequisitesCell({
  stepCode,
  prerequisites,
  allStepOptions,
  onSave,
}: {
  stepCode: string
  prerequisites: string[]
  allStepOptions: AllStepOption[]
  onSave: (stepCode: string, prerequisites: string[]) => Promise<boolean>
}) {
  return (
    <StepCodesPickerCell
      stepCode={stepCode}
      selectedCodes={prerequisites}
      allStepOptions={allStepOptions}
      badgeVariant="outline"
      editLabel={`Edit prerequisites ${stepCode}`}
      dialogTitle={`Prerequisites — ${stepCode}`}
      dialogDescription={`Pilih step yang harus selesai sebelum ${stepCode} bisa aktif.`}
      warning={(draft) =>
        stepCode !== "M1" && draft.length === 0
          ? "Tanpa prerequisites, step ini akan langsung aktif saat project dibuat (sama seperti M1)."
          : null
      }
      onSave={(codes) => onSave(stepCode, codes)}
    />
  )
}

function StepCodesPickerCell({
  stepCode,
  selectedCodes,
  allStepOptions,
  badgeVariant,
  editLabel,
  dialogTitle,
  dialogDescription,
  warning,
  onSave,
}: {
  stepCode: string
  selectedCodes: string[]
  allStepOptions: AllStepOption[]
  badgeVariant: "outline" | "secondary"
  editLabel: string
  dialogTitle: string
  dialogDescription: string
  warning?: (draft: string[]) => string | null
  onSave: (codes: string[]) => Promise<boolean>
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<string[]>(selectedCodes)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (open) setDraft(selectedCodes)
  }, [open, selectedCodes])

  const groupedByStage = useMemo(() => {
    const groups = new Map<number, AllStepOption[]>()
    for (const option of allStepOptions) {
      if (option.code === stepCode) continue
      const list = groups.get(option.stage) ?? []
      list.push(option)
      groups.set(option.stage, list)
    }
    return [...groups.entries()].sort(([a], [b]) => a - b)
  }, [allStepOptions, stepCode])

  const warningMessage = warning?.(draft) ?? null

  function toggle(code: string, checked: boolean) {
    setDraft((prev) =>
      checked ? [...prev, code] : prev.filter((c) => c !== code)
    )
  }

  function handleSave() {
    startTransition(async () => {
      const success = await onSave(draft)
      if (success) setOpen(false)
    })
  }

  return (
    <>
      <div className="flex items-start gap-1.5">
        <div className="flex min-w-0 flex-1 flex-wrap gap-1">
          {selectedCodes.length === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            selectedCodes.map((code) => (
              <Badge key={code} variant={badgeVariant}>
                {code}
              </Badge>
            ))
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={editLabel}
        >
          <Pencil className="size-3.5" />
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-1">
            {groupedByStage.map(([stage, options]) => (
              <div key={stage}>
                <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Tahap {stage}
                  {STAGE_LABELS[stage] ? ` — ${STAGE_LABELS[stage]}` : ""}
                </p>
                <div className="flex flex-col gap-2">
                  {options.map((option) => {
                    const checked = draft.includes(option.code)
                    return (
                      <label
                        key={option.code}
                        className="flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) =>
                            toggle(option.code, value === true)
                          }
                          disabled={isPending}
                          className="mt-0.5"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="font-mono text-xs font-semibold">
                            {option.code}
                          </span>
                          <span className="block text-sm leading-snug">
                            {option.name}
                          </span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {warningMessage && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {warningMessage}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Batal
            </Button>
            <Button type="button" onClick={handleSave} disabled={isPending}>
              {isPending ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function SubstepsCell({
  stepCode,
  substeps,
  onSave,
}: {
  stepCode: string
  substeps: SubstepDefinition[]
  onSave: (stepCode: string, substeps: SubstepDefinition[]) => Promise<boolean>
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<SubstepDefinition[]>(substeps)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (open) setDraft(substeps)
  }, [open, substeps])

  function addRow() {
    setDraft((prev) => [
      ...prev,
      {
        key: slugifySubstepKey(`substep_${prev.length + 1}`),
        label: "",
        sortOrder: prev.length + 1,
      },
    ])
  }

  function updateLabel(index: number, label: string) {
    setDraft((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              label,
              key: row.key || slugifySubstepKey(label),
            }
          : row
      )
    )
  }

  function removeRow(index: number) {
    setDraft((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((row, i) => ({ ...row, sortOrder: i + 1 }))
    )
  }

  function moveRow(index: number, direction: -1 | 1) {
    setDraft((prev) => {
      const next = [...prev]
      const target = index + direction
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next.map((row, i) => ({ ...row, sortOrder: i + 1 }))
    })
  }

  function handleSave() {
    const cleaned = draft
      .map((row, index) => ({
        key: row.key.trim() || slugifySubstepKey(row.label),
        label: row.label.trim(),
        sortOrder: index + 1,
      }))
      .filter((row) => row.label)

    startTransition(async () => {
      const success = await onSave(stepCode, cleaned)
      if (success) setOpen(false)
    })
  }

  return (
    <>
      <div className="flex items-start gap-1.5">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {substeps.length === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            substeps.map((substep, index) => (
              <span key={substep.key} className="text-xs">
                {index + 1}. {substep.label}
              </span>
            ))
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={`Edit sub-step ${stepCode}`}
        >
          <Pencil className="size-3.5" />
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sub-step — {stepCode}</DialogTitle>
            <DialogDescription>
              Tombol aksi berurutan dalam satu step. Step baru dianggap selesai
              setelah semua sub-step selesai, baru unlock step berikutnya.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 py-1">
            {draft.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada sub-step. Step ini pakai satu tombol &ldquo;Tandai Selesai&rdquo;.
              </p>
            ) : (
              draft.map((row, index) => (
                <div key={`${row.key}-${index}`} className="flex items-center gap-2">
                  <span className="w-5 text-xs text-muted-foreground">{index + 1}.</span>
                  <Input
                    value={row.label}
                    placeholder="Label tombol, mis. Sudah ditagih"
                    onChange={(e) => updateLabel(index, e.target.value)}
                    disabled={isPending}
                  />
                  <div className="flex shrink-0 gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      disabled={isPending || index === 0}
                      onClick={() => moveRow(index, -1)}
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      disabled={isPending || index === draft.length - 1}
                      onClick={() => moveRow(index, 1)}
                    >
                      ↓
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-destructive"
                      disabled={isPending}
                      onClick={() => removeRow(index)}
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))
            )}
            <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={isPending}>
              + Tambah sub-step
            </Button>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Batal
            </Button>
            <Button type="button" onClick={handleSave} disabled={isPending}>
              {isPending ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function StepNameCell({
  stepCode,
  name,
  onRename,
}: {
  stepCode: string
  name: string
  onRename: (stepCode: string, name: string) => Promise<boolean>
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(name)
  const [isPending, startTransition] = useTransition()
  const skipBlurRef = useRef(false)

  useEffect(() => {
    if (!isEditing) setValue(name)
  }, [name, isEditing])

  function cancel() {
    skipBlurRef.current = true
    setValue(name)
    setIsEditing(false)
  }

  function commit() {
    if (skipBlurRef.current) {
      skipBlurRef.current = false
      return
    }
    const trimmed = value.trim()
    if (!trimmed || trimmed === name) {
      setValue(name)
      setIsEditing(false)
      return
    }
    startTransition(async () => {
      const success = await onRename(stepCode, trimmed)
      if (!success) setValue(name)
      setIsEditing(false)
    })
  }

  if (isEditing) {
    return (
      <Input
        autoFocus
        value={value}
        disabled={isPending}
        className="h-7 px-1.5 text-sm"
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            commit()
          } else if (e.key === "Escape") {
            e.preventDefault()
            cancel()
          }
        }}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className="group flex items-center gap-1.5 text-left"
    >
      <span className="font-medium leading-snug">{name}</span>
      <Pencil
        className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden
      />
    </button>
  )
}
