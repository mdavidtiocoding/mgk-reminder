"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, RotateCcw, Undo2 } from "lucide-react"

import { StepChecklistFields } from "@/components/project/step-checklist-fields"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { FlowConfigRow } from "@/components/settings/flow-config-table"
import { todayDateKeyWib } from "@/lib/format"
import {
  DATE_FIELD_LABELS,
  getStep,
  type DateField,
} from "@/lib/steps"
import { isChecklistItemComplete } from "@/lib/steps/checklist-response"
import {
  allowsChecklistItemNotes,
  requiresChecklist,
} from "@/lib/steps/completion-mode"
import { isNoteRouteEnabled, resolveNoteRouteTargets } from "@/lib/steps/note-route-config"
import {
  areRequiredSubstepsComplete,
  canCompleteSubstepNow,
  canUndoSubstepNow,
  getSubstepChecklist,
  getSubstepKind,
  substepAllowsItemNotes,
  type SubstepDefinition,
} from "@/lib/steps/substeps"
import { cn } from "@/lib/utils"

type DemoMockCompleteProps = {
  row: FlowConfigRow
}

export function DemoMockComplete({ row }: DemoMockCompleteProps) {
  const hasSubsteps = row.substeps.length > 0

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed bg-muted/20 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Mock test
      </p>
      {hasSubsteps ? (
        <MockSubstepFlow row={row} />
      ) : (
        <MockChecklistFlow row={row} />
      )}
    </div>
  )
}

function MockSubstepFlow({ row }: { row: FlowConfigRow }) {
  const substeps = row.substeps
  const [doneKeys, setDoneKeys] = useState<Set<string>>(new Set())
  const [active, setActive] = useState<SubstepDefinition | null>(null)
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set())
  const [checklistItemNotes, setChecklistItemNotes] = useState<
    Record<string, string>
  >({})

  const stepDone = areRequiredSubstepsComplete(substeps, doneKeys)
  const activeChecklist = active ? getSubstepChecklist(active) : []
  const activeAllowItemNotes = active ? substepAllowsItemNotes(active) : false
  const activeChecklistComplete =
    activeChecklist.length === 0 ||
    activeChecklist.every((item) =>
      isChecklistItemComplete(
        {
          item,
          checked: checkedItems.has(item),
          note: checklistItemNotes[item],
        },
        { allowItemNotes: activeAllowItemNotes }
      )
    )

  function reset() {
    setDoneKeys(new Set())
    setActive(null)
    setCheckedItems(new Set())
    setChecklistItemNotes({})
  }

  function markDone(substep: SubstepDefinition) {
    setDoneKeys((prev) => new Set(prev).add(substep.key))
    setActive(null)
    setCheckedItems(new Set())
    setChecklistItemNotes({})
  }

  function onSubstepClick(substep: SubstepDefinition) {
    const checklist = getSubstepChecklist(substep)
    if (checklist.length > 0) {
      setActive(substep)
      setCheckedItems(new Set())
      setChecklistItemNotes({})
      return
    }
    markDone(substep)
  }

  function confirmActive() {
    if (!active || !activeChecklistComplete) return
    markDone(active)
  }

  function undoDone(substep: SubstepDefinition) {
    if (!canUndoSubstepNow(substep, substeps, doneKeys)) return
    setDoneKeys((prev) => {
      const next = new Set(prev)
      next.delete(substep.key)
      return next
    })
    setActive(null)
  }

  function toggleChecklistItem(item: string) {
    setCheckedItems((prev) => {
      const next = new Set(prev)
      if (next.has(item)) next.delete(item)
      else {
        next.add(item)
        setChecklistItemNotes((notes) => {
          if (!notes[item]) return notes
          const { [item]: _removed, ...rest } = notes
          return rest
        })
      }
      return next
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] leading-snug text-muted-foreground">
          <span className="font-medium text-foreground">Sub-step</span> = rangkaian
          aksi berurutan. Wajib harus urut. Klik = langsung tercatat. Salah klik
          bisa Undo. Kalau ada checklist, checklist itu harus selesai dulu baru
          sub-step bisa Simpan, lalu yang berikutnya unlock.
        </p>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 shrink-0 px-2 text-xs"
          onClick={reset}
        >
          <RotateCcw className="size-3" />
          Reset
        </Button>
      </div>

      {row.checklistItems.length > 0 && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
          Checklist di level step diabaikan kalau ada sub-step. Pakai checklist
          per sub-step di Flow Config.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        {substeps.map((substep, index) => {
          const done = doneKeys.has(substep.key)
          const kind = getSubstepKind(substep)
          const checklist = getSubstepChecklist(substep)
          const actionable = canCompleteSubstepNow(substep, substeps, doneKeys)
          const canUndo = canUndoSubstepNow(substep, substeps, doneKeys)

          return (
            <div
              key={substep.key}
              className="flex flex-col gap-1 rounded-md border bg-background px-3 py-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {index + 1}.
                </span>
                {kind === "reminder" && (
                  <Badge variant="outline" className="text-[10px]">
                    Reminder
                  </Badge>
                )}
                {!done && checklist.length > 0 && (
                  <Badge variant="outline" className="text-[10px]">
                    {checklist.length} checklist
                  </Badge>
                )}
                {done ? (
                  <>
                    <Badge variant="secondary">{substep.label}</Badge>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="ml-auto h-7 px-2 text-xs"
                      disabled={!canUndo}
                      title={
                        canUndo
                          ? "Batalkan kalau salah klik"
                          : "Undo sub-step wajib berikutnya dulu"
                      }
                      onClick={() => undoDone(substep)}
                    >
                      <Undo2 className="mr-1 size-3" />
                      Undo
                    </Button>
                  </>
                ) : actionable ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={kind === "reminder" ? "outline" : "default"}
                    onClick={() => onSubstepClick(substep)}
                  >
                    {substep.label}
                  </Button>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {substep.label}
                    <span className="ml-1 text-[10px]">(tunggu sebelumnya)</span>
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {active && (
        <div className="flex flex-col gap-2 rounded-md border bg-background p-3">
          <p className="text-sm font-medium">{active.label}</p>
          <p className="text-[11px] text-muted-foreground">
            Checklist sub-step ini harus selesai dulu baru bisa Simpan.
            {getSubstepKind(active) === "reminder" &&
              " Reminder tidak memblokir step berikutnya."}
          </p>
          {activeChecklist.length > 0 && (
            <StepChecklistFields
              checklist={activeChecklist}
              checkedItems={checkedItems}
              checklistItemNotes={checklistItemNotes}
              onToggleItem={toggleChecklistItem}
              onItemNoteChange={(item, value) =>
                setChecklistItemNotes((prev) => ({ ...prev, [item]: value }))
              }
              allowItemNotes={activeAllowItemNotes}
              compact
            />
          )}
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setActive(null)}>
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={confirmActive}
              disabled={!activeChecklistComplete}
            >
              Simpan (mock)
            </Button>
          </div>
        </div>
      )}

      {stepDone && (
        <p className="flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-900">
          <CheckCircle2 className="size-3.5 shrink-0" />
          Mock OK — semua sub-step wajib selesai. Step dianggap done (tanpa
          tombol Tandai Selesai terpisah).
        </p>
      )}
    </div>
  )
}

function MockChecklistFlow({ row }: { row: FlowConfigRow }) {
  const stepDef = getStep(row.code)
  const checklist = row.checklistItems
  const completionMode = row.completionMode
  const hasOutcome = row.hasOutcome === true
  const dateInputs = stepDef?.dateInputs ?? []
  const bastChoice = row.bastChoice || stepDef?.bastChoice === true
  const noteRouteTargets = resolveNoteRouteTargets(row.noteRoute, [
    { code: row.code, name: row.name },
    ...(row.noteRoute?.targets ?? []).map((code) => ({
      code,
      name: getStep(code)?.name ?? code,
    })),
  ])
  const showNoteRoute = isNoteRouteEnabled(row.noteRoute)
  const outcomeRescheduleField: DateField | undefined =
    row.outcomeRescheduleField ?? stepDef?.outcomeRescheduleField

  const showChecklist =
    requiresChecklist(completionMode) && checklist.length > 0
  const itemNotesAllowed = allowsChecklistItemNotes(completionMode)

  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set())
  const [checklistItemNotes, setChecklistItemNotes] = useState<
    Record<string, string>
  >({})
  const [dateValues, setDateValues] = useState<Record<string, string>>({})
  const [outcome, setOutcome] = useState<"ok" | "reschedule" | "">("")
  const [rescheduleDate, setRescheduleDate] = useState("")
  const [bast2Required, setBast2Required] = useState<boolean | null>(null)
  const [bastEstimate, setBastEstimate] = useState("")
  const [noteRoutePresence, setNoteRoutePresence] = useState<"ada" | "tidak" | "">(
    ""
  )
  const [noteRouteTo, setNoteRouteTo] = useState(
    noteRouteTargets.length === 1 ? noteRouteTargets[0].code : ""
  )
  const [noteRouteMessage, setNoteRouteMessage] = useState("")
  const [passed, setPassed] = useState(false)

  const isReschedule = hasOutcome && outcome === "reschedule"
  const showDateInputs =
    dateInputs.length > 0 && (!hasOutcome || outcome === "ok")

  function reset() {
    setCheckedItems(new Set())
    setChecklistItemNotes({})
    setDateValues({})
    setOutcome("")
    setRescheduleDate("")
    setBast2Required(null)
    setBastEstimate("")
    setNoteRoutePresence("")
    setNoteRouteTo(noteRouteTargets.length === 1 ? noteRouteTargets[0].code : "")
    setNoteRouteMessage("")
    setPassed(false)
  }

  function toggleChecklistItem(item: string) {
    setPassed(false)
    setCheckedItems((prev) => {
      const next = new Set(prev)
      if (next.has(item)) next.delete(item)
      else {
        next.add(item)
        setChecklistItemNotes((notes) => {
          if (!notes[item]) return notes
          const { [item]: _removed, ...rest } = notes
          return rest
        })
      }
      return next
    })
  }

  const blockers = useMemo(() => {
    const list: string[] = []
    if (hasOutcome && !outcome) list.push("Pilih Selesai atau Belum")
    if (isReschedule && !rescheduleDate) list.push("Pilih tanggal berikutnya")
    if (bastChoice && !isReschedule) {
      if (bast2Required === null) list.push("Pilih BAST 1 saja atau BAST 1+2")
      if (!bastEstimate.trim()) list.push("Isi estimasi BAST")
    }
    if (showNoteRoute && !isReschedule) {
      if (!noteRoutePresence) list.push("Pilih Ada atau Tidak")
      if (noteRoutePresence === "ada") {
        if (!noteRouteMessage.trim()) list.push("Isi catatan untuk step berikutnya")
        if (!noteRouteTo) list.push("Pilih step tujuan")
      }
    }
    if (showChecklist && !isReschedule) {
      const incomplete = checklist.filter(
        (item) =>
          !isChecklistItemComplete(
            {
              item,
              checked: checkedItems.has(item),
              note: checklistItemNotes[item],
            },
            { allowItemNotes: itemNotesAllowed }
          )
      )
      if (incomplete.length > 0) {
        list.push(
          itemNotesAllowed
            ? `${incomplete.length} item belum dicentang / isi keterangan`
            : `${incomplete.length} item belum dicentang`
        )
      }
    }
    if (showDateInputs) {
      const missing = dateInputs.filter((d) => !dateValues[d.field])
      if (missing.length > 0) {
        list.push(`Tanggal wajib: ${missing.map((d) => d.label).join(", ")}`)
      }
    }
    return list
  }, [
    hasOutcome,
    outcome,
    isReschedule,
    rescheduleDate,
    bastChoice,
    bast2Required,
    bastEstimate,
    showNoteRoute,
    noteRoutePresence,
    noteRouteMessage,
    noteRouteTo,
    showChecklist,
    checklist,
    checkedItems,
    checklistItemNotes,
    showDateInputs,
    dateInputs,
    dateValues,
    itemNotesAllowed,
  ])

  const canSubmit = blockers.length === 0
  const hasInteractive =
    showChecklist ||
    hasOutcome ||
    dateInputs.length > 0 ||
    bastChoice ||
    showNoteRoute

  if (!hasInteractive) {
    return (
      <p className="text-[11px] text-muted-foreground">
        Step normal: cukup tombol Tandai Selesai (catatan opsional). Tidak ada
        form checklist / sub-step.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] leading-snug text-muted-foreground">
          {itemNotesAllowed
            ? "Checklist + keterangan: centang yang OK. Yang tidak dicentang wajib isi keterangan."
            : showChecklist
              ? "Checklist: semua item wajib dicentang, tanpa kolom catatan."
              : "Step normal: catatan opsional."}
        </p>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 shrink-0 px-2 text-xs"
          onClick={reset}
        >
          <RotateCcw className="size-3" />
          Reset
        </Button>
      </div>

      {hasOutcome && (
        <div className="flex flex-col gap-2">
          <Label className="text-xs">Selesai / Belum</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={outcome === "ok" ? "default" : "outline"}
              onClick={() => {
                setOutcome("ok")
                setPassed(false)
              }}
            >
              Selesai
            </Button>
            <Button
              type="button"
              size="sm"
              variant={outcome === "reschedule" ? "default" : "outline"}
              onClick={() => {
                setOutcome("reschedule")
                setPassed(false)
              }}
            >
              Belum
            </Button>
          </div>
          {outcome === "reschedule" && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">
                Tanggal berikutnya
                {outcomeRescheduleField
                  ? ` — juga geser ${DATE_FIELD_LABELS[outcomeRescheduleField]}`
                  : ""}
              </Label>
              <Input
                type="date"
                min={todayDateKeyWib()}
                value={rescheduleDate}
                onChange={(e) => {
                  setRescheduleDate(e.target.value)
                  setPassed(false)
                }}
              />
            </div>
          )}
        </div>
      )}

      {showNoteRoute && !isReschedule && (
        <div className="flex flex-col gap-2 rounded-md border bg-background p-2.5">
          <Label className="text-xs">Ada / Tidak</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={noteRoutePresence === "ada" ? "default" : "outline"}
              onClick={() => {
                setNoteRoutePresence("ada")
                setPassed(false)
              }}
            >
              Ada
            </Button>
            <Button
              type="button"
              size="sm"
              variant={noteRoutePresence === "tidak" ? "default" : "outline"}
              onClick={() => {
                setNoteRoutePresence("tidak")
                setPassed(false)
              }}
            >
              Tidak
            </Button>
          </div>
          {noteRoutePresence === "ada" && (
            <>
              <Textarea
                placeholder="Catatan untuk step berikutnya (wajib)"
                value={noteRouteMessage}
                onChange={(e) => {
                  setNoteRouteMessage(e.target.value)
                  setPassed(false)
                }}
                rows={2}
                className="text-sm"
              />
              <Select
                value={noteRouteTo || undefined}
                onValueChange={(value) => {
                  setNoteRouteTo(value)
                  setPassed(false)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih step tujuan" />
                </SelectTrigger>
                <SelectContent>
                  {noteRouteTargets.map((target) => (
                    <SelectItem key={target.code} value={target.code}>
                      {target.code} — {target.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
        </div>
      )}

      {bastChoice && !isReschedule && (
        <div className="flex flex-col gap-2 rounded-md border bg-background p-2.5">
          <Label className="text-xs">Pilihan BAST</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={bast2Required === false ? "default" : "outline"}
              onClick={() => {
                setBast2Required(false)
                setPassed(false)
              }}
            >
              Hanya BAST 1
            </Button>
            <Button
              type="button"
              size="sm"
              variant={bast2Required === true ? "default" : "outline"}
              onClick={() => {
                setBast2Required(true)
                setPassed(false)
              }}
            >
              Ada BAST 1 &amp; BAST 2
            </Button>
          </div>
          <Input
            placeholder="Estimasi BAST (wajib)"
            value={bastEstimate}
            onChange={(e) => {
              setBastEstimate(e.target.value)
              setPassed(false)
            }}
          />
        </div>
      )}

      {showChecklist && !isReschedule && (
        <StepChecklistFields
          checklist={checklist}
          checkedItems={checkedItems}
          checklistItemNotes={checklistItemNotes}
          onToggleItem={toggleChecklistItem}
          onItemNoteChange={(item, value) => {
            setChecklistItemNotes((prev) => ({ ...prev, [item]: value }))
            setPassed(false)
          }}
          compact
          allowItemNotes={itemNotesAllowed}
        />
      )}

      {showDateInputs && (
        <div className="grid gap-2 sm:grid-cols-2">
          {dateInputs.map((input) => (
            <div key={input.field} className="flex flex-col gap-1.5">
              <Label className="text-xs">{input.label}</Label>
              <Input
                type="date"
                value={dateValues[input.field] ?? ""}
                onChange={(e) => {
                  setDateValues((prev) => ({
                    ...prev,
                    [input.field]: e.target.value,
                  }))
                  setPassed(false)
                }}
              />
            </div>
          ))}
        </div>
      )}

      {blockers.length > 0 && (
        <ul className="list-inside list-disc text-[11px] text-amber-800">
          {blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}

      {passed && (
        <p
          className={cn(
            "flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-900"
          )}
        >
          <CheckCircle2 className="size-3.5 shrink-0" />
          Mock OK — form mark done valid. Tidak tersimpan ke project.
        </p>
      )}

      <Button
        type="button"
        size="sm"
        disabled={!canSubmit}
        onClick={() => setPassed(true)}
      >
        Coba tandai selesai (mock)
      </Button>
    </div>
  )
}
