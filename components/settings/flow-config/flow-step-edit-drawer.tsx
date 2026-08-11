"use client"

import { useEffect, useMemo, useState, useTransition } from "react"

import { DiscardChangesDialog } from "@/components/settings/flow-config/discard-changes-dialog"
import { FlowStepDrawerHeader } from "@/components/settings/flow-config/flow-step-drawer-header"
import {
  buildDraftFromRow,
  draftsEqual,
  type AllStepOption,
  type FlowStepDraft,
  type FlowStepDrawerHandlers,
} from "@/components/settings/flow-config/flow-step-drawer-types"
import { TriggerEditor } from "@/components/settings/flow-config/trigger-editor"
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
import { DATE_FIELD_LABELS, getStep, type DateField } from "@/lib/steps"
import {
  COMPLETION_MODE_DESCRIPTIONS,
  COMPLETION_MODE_LABELS,
  STEP_COMPLETION_MODES,
  requiresChecklist,
  type StepCompletionMode,
} from "@/lib/steps/completion-mode"
import { slugifySubstepKey, SUBSTEP_KIND_LABELS, type SubstepKind } from "@/lib/steps/substeps"
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
  const [discardOpen, setDiscardOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (open && row) {
      const base = buildDraftFromRow(row, displayName)
      setDraft(base)
      setInitial(base)
      setError(null)
    }
  }, [open, row, displayName])

  if (!row || !draft || !initial) return null

  const hasUnsaved = !draftsEqual(draft, initial)
  const stepDef = getStep(row.code)
  const hasSubsteps = row.substeps.length > 0 || draft.substeps.length > 0

  function requestClose() {
    if (hasUnsaved) {
      setDiscardOpen(true)
      return
    }
    onOpenChange(false)
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      requestClose()
      return
    }
    onOpenChange(true)
  }

  function handleCancel() {
    if (hasUnsaved) {
      setDiscardOpen(true)
      return
    }
    onOpenChange(false)
  }

  function handleSave() {
    if (!draft) return
    setError(null)
    startTransition(async () => {
      const ok = await handlers.onSave(row!.code, draft, initial!)
      if (ok) {
        onSaved?.()
        onOpenChange(false)
      } else {
        setError("Gagal menyimpan. Periksa kembali konfigurasi.")
      }
    })
  }

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          className={cn(
            "gap-0 border-l-4 border-l-primary/40 bg-background p-0 sm:max-w-lg"
          )}
        >
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

            <EditSection title="Trigger & Reminder">
              <TriggerEditor
                value={draft.trigger}
                onChange={(trigger) => setDraft((d) => d && { ...d, trigger })}
                stepOptions={allStepOptions}
                disabled={isPending}
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

            <EditSection title="BAST">
              <label className="flex items-start gap-2.5 text-sm">
                <Checkbox
                  checked={draft.bastChoice}
                  disabled={isPending}
                  onCheckedChange={(checked) =>
                    setDraft(
                      (d) => d && { ...d, bastChoice: checked === true }
                    )
                  }
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">Tanya pilihan BAST 1 / BAST 2</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Saat mark done, user pilih &quot;Hanya BAST 1&quot; (skip P9/A8)
                    atau &quot;Ada BAST 1 &amp; BAST 2&quot; (+ estimasi). Biasanya
                    aktif di P8.
                  </span>
                </span>
              </label>
            </EditSection>

            {!hasSubsteps && (
              <EditSection title="Mode Selesai & Checklist">
                <Select
                  value={draft.completionMode}
                  onValueChange={(v) =>
                    setDraft(
                      (d) => d && { ...d, completionMode: v as StepCompletionMode }
                    )
                  }
                  disabled={isPending}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STEP_COMPLETION_MODES.map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {COMPLETION_MODE_LABELS[mode]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {COMPLETION_MODE_DESCRIPTIONS[draft.completionMode]}
                </p>
                {requiresChecklist(draft.completionMode) && (
                  <ChecklistEditor
                    items={draft.checklistItems}
                    disabled={isPending}
                    onChange={(items) =>
                      setDraft((d) => d && { ...d, checklistItems: items })
                    }
                  />
                )}
              </EditSection>
            )}

            <EditSection title="Sub-step">
              <p className="text-xs text-muted-foreground">
                Wajib dikerjakan berurutan. Tiap sub-step boleh punya checklist
                sendiri — checklist itu harus selesai dulu baru sub-step bisa
                ditandai done, lalu yang berikutnya unlock. Reminder = tidak
                blok step berikutnya.
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

          <SheetFooter className="shrink-0 flex-row justify-end gap-2 border-t bg-background">
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isPending}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={isPending || !hasUnsaved}>
              {isPending ? "Saving…" : "Save"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <DiscardChangesDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        onDiscard={() => {
          setDraft(initial)
          onOpenChange(false)
        }}
      />
    </>
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

  return (
    <div className="mt-2 flex flex-col gap-2">
      {items.map((item, index) => (
        <div key={`${item}-${index}`} className="flex items-center justify-between text-sm">
          <span>{item}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            disabled={disabled}
            onClick={() => onChange(items.filter((_, i) => i !== index))}
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
            <div className="pl-0 sm:pl-6">
              <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
                Checklist sub-step ini (opsional)
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
              checklist: [],
            },
          ])
        }
      >
        + Tambah sub-step
      </Button>
    </div>
  )
}
