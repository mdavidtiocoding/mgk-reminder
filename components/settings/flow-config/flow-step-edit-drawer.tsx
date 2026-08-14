"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { ChevronDown, ChevronUp, GripVertical, XIcon } from "lucide-react"

import { FlowStepDrawerHeader } from "@/components/settings/flow-config/flow-step-drawer-header"
import {
  buildDraftFromRow,
  draftsEqual,
  type AllStepOption,
  type FlowStepDraft,
  type FlowStepDrawerHandlers,
} from "@/components/settings/flow-config/flow-step-drawer-types"
import type { FlowConfigRow } from "@/components/settings/flow-config-table"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
} from "@/components/ui/sheet"
import { DATE_FIELD_LABELS, type DateField } from "@/lib/steps"
import {
  COMPLETION_MODE_DESCRIPTIONS,
  COMPLETION_MODE_LABELS,
  requiresChecklist,
  type StepCompletionMode,
} from "@/lib/steps/completion-mode"
import {
  slugifySubstepKey,
  SUBSTEP_KIND_LABELS,
  type SubstepChecklistMode,
  type SubstepKind,
} from "@/lib/steps/substeps"
import { cn } from "@/lib/utils"

export function FlowStepEditDrawer({
  row,
  displayName,
  allStepOptions,
  open,
  onOpenChange,
  handlers,
  onSaved,
}: {
  row: FlowConfigRow | null
  displayName: string
  allStepOptions: AllStepOption[]
  open: boolean
  onOpenChange: (open: boolean) => void
  handlers: FlowStepDrawerHandlers
  onSaved?: () => void
}) {
  const [draft, setDraft] = useState<FlowStepDraft | null>(null)
  const [initial, setInitial] = useState<FlowStepDraft | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (open && row) {
      const base = buildDraftFromRow(row, displayName)
      setDraft(base)
      setInitial(base)
      setError(null)
      setConfirmDiscard(false)
    }
  }, [open, row, displayName])

  const hasUnsaved = Boolean(draft && initial && !draftsEqual(draft, initial))
  const hasSubsteps = Boolean(
    row && draft && (row.substeps.length > 0 || draft.substeps.length > 0)
  )

  function forceClose() {
    setConfirmDiscard(false)
    setError(null)
    onOpenChange(false)
  }

  function requestClose() {
    if (hasUnsaved && !confirmDiscard) {
      setConfirmDiscard(true)
      return
    }
    forceClose()
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      requestClose()
      return
    }
    onOpenChange(true)
  }

  function handleSave() {
    if (!draft || !initial || !row) return
    setError(null)
    startTransition(async () => {
      const result = await handlers.onSave(row.code, draft, initial)
      if (result.success) {
        onSaved?.()
        setConfirmDiscard(false)
        onOpenChange(false)
      } else {
        setError(
          result.error?.trim() || "Gagal menyimpan. Periksa kembali konfigurasi."
        )
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        showCloseButton={false}
        className={cn(
          "gap-0 border-l-4 border-l-primary/40 bg-background p-0 sm:max-w-lg"
        )}
        onEscapeKeyDown={(event) => {
          event.preventDefault()
          requestClose()
        }}
        onInteractOutside={(event) => {
          event.preventDefault()
          requestClose()
        }}
      >
        <button
          type="button"
          onClick={requestClose}
          className="absolute top-4 right-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none"
          aria-label="Tutup"
        >
          <XIcon className="size-4" />
        </button>
        {row && draft && initial ? (
          <>
        <SheetHeader className="shrink-0 border-b bg-background">
            <FlowStepDrawerHeader
              row={row}
              displayName={displayName}
              mode="edit"
              hasUnsavedChanges={hasUnsaved}
            />
          </SheetHeader>

          <SheetBody className="flex min-h-0 flex-col gap-5">
            <EditSection title="Nama Step">
              <Input
                value={draft.name}
                onChange={(e) => setDraft((d) => d && { ...d, name: e.target.value })}
                disabled={isPending}
              />
            </EditSection>

            <EditSection title="Prasyarat">
              <StepCodesPicker
                stepCode={row.code}
                selected={draft.prerequisites}
                allStepOptions={allStepOptions}
                disabled={isPending}
                onChange={(codes) =>
                  setDraft((d) => d && { ...d, prerequisites: codes })
                }
              />
              {row.code !== "M1" && draft.prerequisites.length === 0 && (
                <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-800">
                  Tanpa prasyarat, step langsung aktif saat project dibuat.
                </p>
              )}
            </EditSection>

            <EditSection title="Memicu (Unlock)">
              <StepCodesPicker
                stepCode={row.code}
                selected={draft.unlocksSteps}
                allStepOptions={allStepOptions}
                disabled={isPending}
                onChange={(codes) =>
                  setDraft((d) => d && { ...d, unlocksSteps: codes })
                }
              />
            </EditSection>

            <EditSection title="Catatan ke step berikutnya">
              <label className="flex items-start gap-2.5 text-sm">
                <Checkbox
                  checked={draft.noteRoute.enabled}
                  disabled={isPending}
                  onCheckedChange={(checked) =>
                    setDraft((d) => {
                      if (!d) return d
                      const enabled = checked === true
                      return {
                        ...d,
                        noteRoute: {
                          enabled,
                          targets:
                            enabled && d.noteRoute.targets.length === 0
                              ? [...d.unlocksSteps]
                              : d.noteRoute.targets,
                        },
                      }
                    })
                  }
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">Tanya Ada / Tidak</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Saat mark done, user pilih Ada atau Tidak. Jika Ada, wajib
                    isi catatan dan pilih step tujuan dari dropdown di bawah.
                  </span>
                </span>
              </label>
              {draft.noteRoute.enabled && (
                <div className="mt-3">
                  <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
                    Step yang muncul di dropdown
                  </p>
                  <StepCodesPicker
                    stepCode={row.code}
                    selected={draft.noteRoute.targets}
                    allStepOptions={allStepOptions}
                    disabled={isPending}
                    onChange={(codes) =>
                      setDraft(
                        (d) =>
                          d && {
                            ...d,
                            noteRoute: { ...d.noteRoute, targets: codes },
                          }
                      )
                    }
                  />
                  {draft.noteRoute.targets.length === 0 && (
                    <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-800">
                      Pilih minimal satu step tujuan.
                    </p>
                  )}
                </div>
              )}
            </EditSection>

            <EditSection title="Delay">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="delay-hours" className="text-xs">
                  Delay setelah (jam)
                </Label>
                <Input
                  id="delay-hours"
                  type="number"
                  min={1}
                  placeholder="Kosong = default Settings"
                  value={draft.delayHours ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value.trim()
                    setDraft((d) => {
                      if (!d) return d
                      if (!raw) return { ...d, delayHours: null }
                      const n = parseInt(raw, 10)
                      return {
                        ...d,
                        delayHours: Number.isInteger(n) && n >= 1 ? n : d.delayHours,
                      }
                    })
                  }}
                  disabled={isPending}
                  className="h-8"
                />
                <p className="text-[11px] text-muted-foreground">
                  Baru dihitung Delay setelah step unlock selama jam ini.
                  Kosong = pakai default di Settings (12 jam, bisa diubah).
                </p>
              </div>
            </EditSection>

            <EditSection title="Step reschedule">
              <label className="flex items-start gap-2.5 text-sm">
                <Checkbox
                  checked={draft.hasOutcome}
                  disabled={isPending}
                  onCheckedChange={(checked) =>
                    setDraft((d) => {
                      if (!d) return d
                      const enabled = checked === true
                      return {
                        ...d,
                        hasOutcome: enabled,
                        outcomeRescheduleField: enabled
                          ? d.outcomeRescheduleField
                          : null,
                      }
                    })
                  }
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">Aktifkan step reschedule</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Saat mark done, tanya Selesai / Belum. Kalau Belum, pilih
                    tanggal berikutnya. Step tetap aktif dan ditanya lagi di
                    tanggal itu.
                  </span>
                </span>
              </label>
              {draft.hasOutcome && (
                <div className="mt-3 flex flex-col gap-1.5">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Juga geser tanggal project (opsional)
                  </p>
                  <Select
                    value={draft.outcomeRescheduleField ?? "none"}
                    onValueChange={(value) =>
                      setDraft(
                        (d) =>
                          d && {
                            ...d,
                            outcomeRescheduleField:
                              value === "none" ? null : (value as DateField),
                          }
                      )
                    }
                    disabled={isPending}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Tidak — hanya jadwal step ini</SelectItem>
                      {(Object.keys(DATE_FIELD_LABELS) as DateField[]).map(
                        (field) => (
                          <SelectItem key={field} value={field}>
                            {DATE_FIELD_LABELS[field]}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </EditSection>

            {!hasSubsteps && (
              <EditSection title="Mode Selesai & Checklist">
                <label className="flex items-start gap-2.5 text-sm">
                  <Checkbox
                    checked={requiresChecklist(draft.completionMode)}
                    disabled={isPending}
                    onCheckedChange={(checked) =>
                      setDraft((d) => {
                        if (!d) return d
                        if (checked === true) {
                          return {
                            ...d,
                            completionMode:
                              d.completionMode === "checklist_keterangan"
                                ? "checklist_keterangan"
                                : "checklist",
                          }
                        }
                        return {
                          ...d,
                          completionMode: "normal",
                          checklistItems: [],
                        }
                      })
                    }
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium">Pakai checklist</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Centang dulu kalau step ini punya checklist saat mark done.
                    </span>
                  </span>
                </label>
                {requiresChecklist(draft.completionMode) ? (
                  <div className="mt-3 flex flex-col gap-2">
                    <Label className="text-xs">Mode checklist</Label>
                    <Select
                      value={draft.completionMode}
                      onValueChange={(v) =>
                        setDraft(
                          (d) =>
                            d && {
                              ...d,
                              completionMode: v as StepCompletionMode,
                            }
                        )
                      }
                      disabled={isPending}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="checklist">
                          {COMPLETION_MODE_LABELS.checklist}
                        </SelectItem>
                        <SelectItem value="checklist_keterangan">
                          {COMPLETION_MODE_LABELS.checklist_keterangan}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {COMPLETION_MODE_DESCRIPTIONS[draft.completionMode]}
                    </p>
                    <ChecklistEditor
                      items={draft.checklistItems}
                      disabled={isPending}
                      onChange={(items) =>
                        setDraft((d) => d && { ...d, checklistItems: items })
                      }
                    />
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {COMPLETION_MODE_DESCRIPTIONS.normal}
                  </p>
                )}
              </EditSection>
            )}

            <EditSection title="Sub-step">
              <p className="text-xs text-muted-foreground">
                Wajib dikerjakan berurutan. Centang &quot;Pakai checklist&quot; per
                sub-step kalau perlu — pilih mode Checklist atau Checklist +
                Keterangan. Reminder = tidak blok step berikutnya.
              </p>
              <SubstepsForm
                substeps={draft.substeps}
                disabled={isPending}
                onChange={(substeps) => setDraft((d) => d && { ...d, substeps })}
              />
            </EditSection>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </SheetBody>

          <SheetFooter className="shrink-0 flex-col gap-2 border-t bg-background sm:flex-col">
            {confirmDiscard && (
              <p className="w-full text-sm text-muted-foreground">
                Ada perubahan yang belum disimpan. Buang dan tutup panel?
              </p>
            )}
            <div className="flex w-full justify-end gap-2">
              {confirmDiscard ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setConfirmDiscard(false)}
                  >
                    Lanjut edit
                  </Button>
                  <Button type="button" variant="destructive" onClick={forceClose}>
                    Buang & tutup
                  </Button>
                </>
              ) : (
                <>
                  <Button type="button" variant="outline" onClick={requestClose}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSave}
                    disabled={isPending || !hasUnsaved}
                  >
                    {isPending ? "Saving…" : "Save"}
                  </Button>
                </>
              )}
            </div>
          </SheetFooter>
          </>
        ) : null}
        </SheetContent>
      </Sheet>
  )
}

function EditSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex shrink-0 flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="rounded-lg border border-border bg-card p-3">{children}</div>
    </section>
  )
}

function StepCodesPicker({
  stepCode,
  selected,
  allStepOptions,
  disabled,
  onChange,
}: {
  stepCode: string
  selected: string[]
  allStepOptions: AllStepOption[]
  disabled?: boolean
  onChange: (codes: string[]) => void
}) {
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

  function toggle(code: string, checked: boolean) {
    onChange(checked ? [...selected, code] : selected.filter((c) => c !== code))
  }

  return (
    <div className="max-h-48 overflow-y-auto">
      {groupedByStage.map(([stage, options]) => (
        <div key={stage} className="mb-3">
          <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">
            Tahap {stage}
          </p>
          <div className="flex flex-col gap-1">
            {options.map((option) => (
              <label
                key={option.code}
                className={cn(
                  "flex items-start gap-2 rounded px-1 py-0.5",
                  disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-muted/50"
                )}
              >
                <Checkbox
                  checked={selected.includes(option.code)}
                  onCheckedChange={(v) => toggle(option.code, v === true)}
                  disabled={disabled}
                  className="mt-0.5"
                />
                <span className="text-xs">
                  <span className="font-mono font-semibold">{option.code}</span>{" "}
                  {option.name}
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function ChecklistEditor({
  items,
  disabled,
  onChange,
}: {
  items: string[]
  disabled?: boolean
  onChange: (items: string[]) => void
}) {
  const [newItem, setNewItem] = useState("")
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const gripArmedRef = useRef(false)

  function moveItem(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
      return
    }
    const next = [...items]
    const [moved] = next.splice(from, 1)
    if (moved == null) return
    next.splice(to, 0, moved)
    onChange(next)
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      {items.length > 1 && (
        <p className="text-[11px] text-muted-foreground">
          Drag ikon garis untuk mengubah urutan.
        </p>
      )}
      {items.map((item, index) => (
        <div
          key={`${item}-${index}`}
          draggable={!disabled}
          onDragStart={(e) => {
            if (!gripArmedRef.current) {
              e.preventDefault()
              return
            }
            e.dataTransfer.setData("text/plain", String(index))
            e.dataTransfer.effectAllowed = "move"
            setDragIndex(index)
          }}
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = "move"
            if (overIndex !== index) setOverIndex(index)
          }}
          onDrop={(e) => {
            e.preventDefault()
            const from = Number(e.dataTransfer.getData("text/plain"))
            if (Number.isInteger(from)) moveItem(from, index)
            setDragIndex(null)
            setOverIndex(null)
            gripArmedRef.current = false
          }}
          onDragEnd={() => {
            setDragIndex(null)
            setOverIndex(null)
            gripArmedRef.current = false
          }}
          className={cn(
            "flex items-center gap-1 rounded-md border bg-background px-1.5 py-1 text-sm",
            dragIndex === index && "opacity-50",
            overIndex === index && dragIndex != null && dragIndex !== index && "border-primary"
          )}
        >
          <button
            type="button"
            className={cn(
              "inline-flex shrink-0 rounded p-0.5 text-muted-foreground",
              disabled ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing touch-none"
            )}
            disabled={disabled}
            aria-label="Geser urutan"
            onPointerDown={() => {
              gripArmedRef.current = !disabled
            }}
            onPointerUp={() => {
              gripArmedRef.current = false
            }}
          >
            <GripVertical className="size-3.5" aria-hidden />
          </button>
          <span className="min-w-0 flex-1">{item}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 px-0"
            disabled={disabled || index === 0}
            onClick={() => moveItem(index, index - 1)}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Naikkan"
          >
            <ChevronUp className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 px-0"
            disabled={disabled || index === items.length - 1}
            onClick={() => moveItem(index, index + 1)}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Turunkan"
          >
            <ChevronDown className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            disabled={disabled}
            onClick={() => onChange(items.filter((_, i) => i !== index))}
            onPointerDown={(e) => e.stopPropagation()}
          >
            Hapus
          </Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Input
          value={newItem}
          placeholder="Item checklist"
          disabled={disabled}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newItem.trim()) {
              e.preventDefault()
              onChange([...items, newItem.trim()])
              setNewItem("")
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || !newItem.trim()}
          onClick={() => {
            onChange([...items, newItem.trim()])
            setNewItem("")
          }}
        >
          +
        </Button>
      </div>
    </div>
  )
}

function SubstepsForm({
  substeps,
  disabled,
  onChange,
}: {
  substeps: FlowStepDraft["substeps"]
  disabled?: boolean
  onChange: (substeps: FlowStepDraft["substeps"]) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      {substeps.length === 0 ? (
        <p className="text-xs text-muted-foreground">Belum ada sub-step.</p>
      ) : (
        substeps.map((row, index) => (
          <div
            key={`${row.key}-${index}`}
            className="flex flex-col gap-2 rounded-md border bg-background p-2.5"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <span className="w-5 shrink-0 text-xs text-muted-foreground">
                {index + 1}.
              </span>
              <Input
                value={row.label}
                placeholder="Label tombol"
                disabled={disabled}
                className="min-w-0 flex-1"
                onChange={(e) =>
                  onChange(
                    substeps.map((r, i) =>
                      i === index ? { ...r, label: e.target.value } : r
                    )
                  )
                }
              />
              <Select
                value={row.kind ?? "required"}
                onValueChange={(value) =>
                  onChange(
                    substeps.map((r, i) =>
                      i === index ? { ...r, kind: value as SubstepKind } : r
                    )
                  )
                }
                disabled={disabled}
              >
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="required">
                    {SUBSTEP_KIND_LABELS.required}
                  </SelectItem>
                  <SelectItem value="reminder">
                    {SUBSTEP_KIND_LABELS.reminder}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={() => onChange(substeps.filter((_, i) => i !== index))}
              >
                ×
              </Button>
            </div>
            <div className="flex flex-col gap-2 pl-0 sm:pl-6">
              <label className="flex items-start gap-2.5 text-sm">
                <Checkbox
                  checked={
                    row.checklistMode != null ||
                    (row.checklist ?? []).length > 0
                  }
                  disabled={disabled}
                  onCheckedChange={(checked) =>
                    onChange(
                      substeps.map((r, i) => {
                        if (i !== index) return r
                        if (checked === true) {
                          return {
                            ...r,
                            checklistMode:
                              r.checklistMode === "checklist_keterangan"
                                ? "checklist_keterangan"
                                : "checklist",
                            checklist: r.checklist ?? [],
                          }
                        }
                        return {
                          ...r,
                          checklistMode: undefined,
                          checklist: [],
                        }
                      })
                    )
                  }
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">Pakai checklist</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    Checklist harus selesai dulu baru sub-step bisa ditandai done.
                  </span>
                </span>
              </label>
              {(row.checklistMode != null ||
                (row.checklist ?? []).length > 0) && (
                <div className="flex flex-col gap-2">
                  <Label className="text-xs">Mode checklist</Label>
                  <Select
                    value={
                      row.checklistMode === "checklist"
                        ? "checklist"
                        : "checklist_keterangan"
                    }
                    onValueChange={(value) =>
                      onChange(
                        substeps.map((r, i) =>
                          i === index
                            ? {
                                ...r,
                                checklistMode: value as SubstepChecklistMode,
                              }
                            : r
                        )
                      )
                    }
                    disabled={disabled}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="checklist">
                        {COMPLETION_MODE_LABELS.checklist}
                      </SelectItem>
                      <SelectItem value="checklist_keterangan">
                        {COMPLETION_MODE_LABELS.checklist_keterangan}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    {
                      COMPLETION_MODE_DESCRIPTIONS[
                        row.checklistMode === "checklist"
                          ? "checklist"
                          : "checklist_keterangan"
                      ]
                    }
                  </p>
                  <ChecklistEditor
                    items={row.checklist ?? []}
                    disabled={disabled}
                    onChange={(items) =>
                      onChange(
                        substeps.map((r, i) =>
                          i === index ? { ...r, checklist: items } : r
                        )
                      )
                    }
                  />
                </div>
              )}
            </div>
          </div>
        ))
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() =>
          onChange([
            ...substeps,
            {
              key: slugifySubstepKey(`substep_${substeps.length + 1}`),
              label: "",
              sortOrder: substeps.length + 1,
              kind: "required",
            },
          ])
        }
      >
        + Tambah sub-step
      </Button>
    </div>
  )
}
