"use client"

import { Copy, Pencil, RotateCcw } from "lucide-react"
import { useState } from "react"

import {
  DependencyDisplay,
  SubstepDisplay,
  UnlockDisplay,
} from "@/components/settings/flow-config/display-cells"
import { DuplicateStepDialog } from "@/components/settings/flow-config/duplicate-step-dialog"
import { FlowStepDrawerHeader } from "@/components/settings/flow-config/flow-step-drawer-header"
import type { AllStepOption } from "@/components/settings/flow-config/flow-step-drawer-types"
import type { FlowConfigRow } from "@/components/settings/flow-config-table"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
} from "@/components/ui/sheet"
import {
  COMPLETION_MODE_LABELS,
  type StepCompletionMode,
} from "@/lib/steps/completion-mode"
import { cn } from "@/lib/utils"

function ReadOnlySection({
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
      <div className="rounded-lg border bg-muted/20 p-3">{children}</div>
    </section>
  )
}

export function FlowStepViewDrawer({
  row,
  displayName,
  nameLookup,
  allStepOptions,
  open,
  onOpenChange,
  onEditStep,
  onResetStep,
  onDuplicateSuccess,
}: {
  row: FlowConfigRow | null
  displayName: string
  nameLookup: Map<string, string>
  allStepOptions: AllStepOption[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onEditStep: () => void
  onResetStep: () => Promise<boolean>
  onDuplicateSuccess?: () => void
}) {
  const [duplicateOpen, setDuplicateOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetting, setResetting] = useState(false)

  if (!row) return null

  async function handleReset() {
    setResetting(true)
    const ok = await onResetStep()
    setResetting(false)
    if (ok) {
      setResetOpen(false)
      onOpenChange(false)
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="gap-0 bg-background p-0 sm:max-w-lg">
          <SheetHeader className="shrink-0 border-b bg-background">
            <FlowStepDrawerHeader row={row} displayName={displayName} mode="view" />
          </SheetHeader>

          <SheetBody className="flex min-h-0 flex-col gap-5">
            <ReadOnlySection title="Nama Step">
              <p className="text-sm font-medium">{displayName}</p>
            </ReadOnlySection>

            <ReadOnlySection title="Prasyarat">
              <DependencyDisplay codes={row.prerequisites} names={nameLookup} maxVisible={99} />
            </ReadOnlySection>

            <ReadOnlySection title="Memicu (Unlock)">
              <UnlockDisplay codes={row.unlocksSteps} names={nameLookup} />
            </ReadOnlySection>

            <ReadOnlySection title="Notif & kalender">
              <p className="text-sm">Saat unlock: notif + kalender langsung.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Repeat tiap N hari diatur di Settings → Reminder.
              </p>
            </ReadOnlySection>

            <ReadOnlySection title="Delay">
              <p className="text-sm">
                {row.delayHours
                  ? `${row.delayHours} jam setelah unlock`
                  : "Default Settings"}
              </p>
            </ReadOnlySection>

            <ReadOnlySection title="Step reschedule">
              {row.hasOutcome ? (
                <div className="space-y-1">
                  <p className="text-sm">Aktif — tanya Selesai / Belum</p>
                  <p className="text-xs text-muted-foreground">
                    {row.outcomeRescheduleField
                      ? `Juga geser ${row.outcomeRescheduleField}`
                      : "Hanya jadwal step ini, tanggal project tidak berubah"}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Tidak aktif</p>
              )}
            </ReadOnlySection>

            <ReadOnlySection title="Catatan ke step berikutnya">
              {row.noteRoute?.enabled ? (
                <div className="space-y-1">
                  <p className="text-sm">Tanya Ada / Tidak</p>
                  <p className="text-xs text-muted-foreground">
                    Dropdown:{" "}
                    {row.noteRoute.targets.length > 0
                      ? row.noteRoute.targets.join(", ")
                      : "—"}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Tidak aktif</p>
              )}
            </ReadOnlySection>

            <ReadOnlySection title="Mode Selesai">
              {row.substeps.length > 0 ? (
                <p className="text-sm">Sub-step (otomatis)</p>
              ) : (
                <>
                  <p className="text-sm font-medium">
                    {COMPLETION_MODE_LABELS[row.completionMode]}
                  </p>
                  {row.checklistItems.length > 0 && (
                    <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
                      {row.checklistItems.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </ReadOnlySection>

            <ReadOnlySection title="Sub-step">
              <SubstepDisplay substeps={row.substeps} />
            </ReadOnlySection>

            <ReadOnlySection title="Terakhir diperbarui">
              <p className="text-xs text-muted-foreground">
                Tidak tersedia (database belum menyimpan timestamp).
              </p>
            </ReadOnlySection>
          </SheetBody>

          <SheetFooter className="shrink-0 flex-col items-stretch gap-4 border-t bg-muted/10">
            <div className="w-full">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Actions
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={onEditStep}
                >
                  <Pencil className="size-4" />
                  Switch ke Edit Mode
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() => setDuplicateOpen(true)}
                >
                  <Copy className="size-4" />
                  Duplicate Step
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2 text-destructive hover:text-destructive"
                  onClick={() => setResetOpen(true)}
                >
                  <RotateCcw className="size-4" />
                  Delete Step
                </Button>
              </div>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <DuplicateStepDialog
        open={duplicateOpen}
        onOpenChange={setDuplicateOpen}
        sourceCode={row.code}
        sourceName={displayName}
        allStepOptions={allStepOptions}
        onSuccess={() => {
          setDuplicateOpen(false)
          onDuplicateSuccess?.()
          onOpenChange(false)
        }}
      />

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus konfigurasi {row.code}?</DialogTitle>
            <DialogDescription>
              Step tidak bisa dihapus dari workflow bawaan. Tindakan ini mengembalikan
              prasyarat, checklist, mode selesai, dan sub-step ke default workflow.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)} disabled={resetting}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleReset} disabled={resetting}>
              {resetting ? "Mereset…" : "Reset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
