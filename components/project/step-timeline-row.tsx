"use client"

import { ArrowDown, AlertTriangle, CheckCircle2, Circle, Lock } from "lucide-react"

import { IncomingStepNotes } from "@/components/project/incoming-step-notes"
import { MarkDoneDialog } from "@/components/project/mark-done-dialog"
import { SetFollowUpDialog } from "@/components/project/set-followup-dialog"
import { StepChecklistCompletion } from "@/components/project/step-checklist-completion"
import { StepRescheduleNotice } from "@/components/project/step-reschedule-notice"
import { StepUndoButton } from "@/components/project/step-undo-button"
import { SubstepActions } from "@/components/project/substep-actions"
import { Badge } from "@/components/ui/badge"
import { formatDateTime, formatFollowUpSchedule } from "@/lib/format"
import type { ProjectDetail, StepTimelineItem } from "@/lib/projects/detail"
import { pendingPrerequisitesInStage } from "@/lib/projects/timeline-display"
import { DIVISION_BADGE_STYLES } from "@/lib/steps"
import { COMPLETION_MODE_LABELS } from "@/lib/steps/completion-mode"
import { usesInlineChecklist } from "@/lib/steps/inline-checklist"
import { cn } from "@/lib/utils"

export function StepTimelineStatusIcon({
  status,
  className,
}: {
  status: StepTimelineItem["status"]
  className?: string
}) {
  if (status === "done") {
    return <CheckCircle2 className={cn("size-7 text-primary", className)} aria-hidden />
  }
  if (status === "active") {
    return (
      <Circle className={cn("size-7 fill-primary/15 text-primary", className)} aria-hidden />
    )
  }
  return (
    <Lock className={cn("size-7 text-muted-foreground/50", className)} aria-hidden />
  )
}

function StepFlowWarning({ codes }: { codes: string[] }) {
  if (codes.length === 0) return null

  return (
    <div
      className="flex items-start gap-2 rounded-md border border-amber-300/80 bg-amber-50 px-2.5 py-2 text-amber-950"
      role="status"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
      <p className="text-xs leading-snug">
        <span className="font-medium">Step sebelumnya belum selesai:</span>{" "}
        {codes.join(", ")}
      </p>
    </div>
  )
}

function StepHeader({ step }: { step: StepTimelineItem }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">
            Step {step.code} · Tahap {step.stage}
          </p>
          <p className="mt-0.5 font-medium leading-snug">{step.name}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {step.flowWarnings.length > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800"
              title={`Step sebelumnya belum selesai: ${step.flowWarnings.join(", ")}`}
            >
              <AlertTriangle className="size-3" aria-hidden />
              Peringatan
            </span>
          )}
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
              DIVISION_BADGE_STYLES[step.division].badge
            )}
          >
            {step.divisionLabel}
          </span>
          {step.status === "active" && <Badge variant="default">Aktif</Badge>}
        </div>
      </div>
      <StepFlowWarning codes={step.flowWarnings} />
    </div>
  )
}

function StepDoneBody({
  project,
  step,
}: {
  project: ProjectDetail
  step: StepTimelineItem
}) {
  const capturedDates =
    step.dateInputs?.map((input) => {
      const value =
        input.field === "ex_work_date"
          ? project.exWorkDate
          : input.field === "etd_date"
            ? project.etdDate
            : input.field === "eta_date"
              ? project.etaDate
              : input.field === "mos_date"
                ? project.mosDate
                : null
      return { label: input.label, value }
    }) ?? []

  return (
    <div className="mt-3 space-y-3">
      <div className="space-y-1 text-sm text-muted-foreground">
        {step.completedByName && (
          <p>
            Selesai oleh:{" "}
            <span className="text-foreground">{step.completedByName}</span>
          </p>
        )}
        {step.completedAt && <p>{formatDateTime(step.completedAt)}</p>}
        {step.outcome && step.outcome !== "skipped" && (
          <p>
            Hasil:{" "}
            <span className="text-foreground">
              {step.outcome === "reschedule" ? "Perlu Reschedule" : "OK"}
            </span>
          </p>
        )}
        {step.outcome === "skipped" && (
          <p className="text-amber-800">Dilewati (tidak applicable)</p>
        )}
        {capturedDates.map(
          (row) =>
            row.value && (
              <p key={row.label}>
                {row.label}:{" "}
                <span className="font-medium text-foreground">{row.value}</span>
              </p>
            )
        )}
        {step.note && (
          <div className="rounded-md border bg-muted/40 px-3 py-2">
            <p className="mb-1 text-xs font-medium text-foreground">Hasil / catatan</p>
            <pre className="whitespace-pre-wrap font-sans text-sm text-foreground">
              {step.note}
            </pre>
          </div>
        )}
        {(step.incomingNotes?.length ?? 0) > 0 && (
          <IncomingStepNotes notes={step.incomingNotes ?? []} />
        )}
      </div>
      {step.canUndo && (
        <StepUndoButton projectId={project.id} stepCode={step.code} />
      )}
      {step.hasPendingReminderSubsteps && step.substeps.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
          <p className="mb-2 text-xs font-medium text-amber-900">
            Reminder sub-step masih pending
          </p>
          <SubstepActions
            projectId={project.id}
            stepCode={step.code}
            substeps={step.substeps}
            completions={step.substepCompletions}
            canEdit={step.canEditSubsteps}
          />
        </div>
      )}
    </div>
  )
}

function StepActiveBody({
  project,
  step,
  compact = false,
}: {
  project: ProjectDetail
  step: StepTimelineItem
  compact?: boolean
}) {
  const inlineChecklist = usesInlineChecklist({
    completionMode: step.completionMode,
    checklist: step.checklist,
    hasOutcome: step.hasOutcome,
    dateInputs: step.dateInputs,
    noteRoute: (step.noteRouteTargets?.length ?? 0) > 0,
  })

  return (
    <div className={cn("space-y-3", compact ? "mt-2" : "mt-3")}>
      {!compact && <StepFlowWarning codes={step.flowWarnings} />}
      {(step.incomingNotes?.length ?? 0) > 0 && (
        <IncomingStepNotes notes={step.incomingNotes ?? []} compact={compact} />
      )}
      {!compact && (
        <p className="text-sm text-muted-foreground">
          PIC: <span className="text-foreground">{step.divisionLabel}</span>
        </p>
      )}
      {step.lastRescheduleDate && (
        <StepRescheduleNotice
          rescheduleDate={step.lastRescheduleDate}
          rescheduledAt={step.lastRescheduleAt}
          className={compact ? "text-xs" : undefined}
        />
      )}
      {step.substeps.length > 0 && (
        <SubstepActions
          projectId={project.id}
          stepCode={step.code}
          substeps={step.substeps}
          completions={step.substepCompletions}
          canEdit={step.canEditSubsteps}
        />
      )}
      {step.completionMode && step.completionMode !== "normal" && step.substeps.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Mode: {COMPLETION_MODE_LABELS[step.completionMode]}
        </p>
      )}
      {step.checklist && step.checklist.length > 0 && !inlineChecklist && (
        <p className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>
          Checklist: {step.checklist.join(", ")}
        </p>
      )}
      {!compact && (
        <p className="text-sm text-muted-foreground">
          Reminder terakhir:{" "}
          {step.lastReminderAt ? formatDateTime(step.lastReminderAt) : "Belum ada"}
        </p>
      )}
      {inlineChecklist && step.canComplete && step.substeps.length === 0 && step.checklist && (
        <StepChecklistCompletion
          projectId={project.id}
          stepCode={step.code}
          checklist={step.checklist}
          completionMode={step.completionMode}
          compact={compact}
        />
      )}
      {step.followUpDate && (
        <p className={cn("text-primary", compact ? "text-xs" : "text-sm")}>
          Follow-up dijadwalkan:{" "}
          {formatFollowUpSchedule(step.followUpDate, step.followUpTime ?? "09:00:00")}
          {step.followUpNote ? (
            <span className="block text-muted-foreground italic">
              &ldquo;{step.followUpNote}&rdquo;
            </span>
          ) : null}
        </p>
      )}
      {step.canComplete && step.substeps.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {!inlineChecklist && (
            <MarkDoneDialog
              projectId={project.id}
              stepCode={step.code}
              stepName={step.name}
              completionMode={step.completionMode}
              checklist={step.checklist}
              dateInputs={step.dateInputs}
              hasOutcome={step.hasOutcome}
              outcomeRescheduleField={step.outcomeRescheduleField}
              bastChoice={step.bastChoice}
              noteRouteTargets={step.noteRouteTargets}
            />
          )}
          <SetFollowUpDialog
            projectId={project.id}
            stepCode={step.code}
            stepName={step.name}
            existingDate={step.followUpDate}
            existingTime={step.followUpTime}
            existingNote={step.followUpNote}
          />
        </div>
      )}
      {step.canComplete && step.substeps.length > 0 && (
        <SetFollowUpDialog
          projectId={project.id}
          stepCode={step.code}
          stepName={step.name}
          existingDate={step.followUpDate}
          existingTime={step.followUpTime}
          existingNote={step.followUpNote}
        />
      )}
    </div>
  )
}

export function StepTimelineCard({
  project,
  step,
  nested = false,
}: {
  project: ProjectDetail
  step: StepTimelineItem
  nested?: boolean
}) {
  return (
    <div
      id={`step-${step.code}`}
      className={cn(
        "min-w-0 flex-1 scroll-mt-24 rounded-xl border border-l-4 p-4",
        DIVISION_BADGE_STYLES[step.division].border,
        step.status === "active" && "border-primary/40 bg-primary/5",
        step.flowWarnings.length > 0 && "border-amber-300/60 bg-amber-50/40",
        step.status === "locked" && !nested && "opacity-60",
        nested && step.status === "locked" && "opacity-80"
      )}
    >
      <StepHeader step={step} />
      {step.status === "done" && <StepDoneBody project={project} step={step} />}
      {step.status === "active" && (
        <StepActiveBody project={project} step={step} compact={nested} />
      )}
      {step.status === "locked" && (
        <div className="mt-2 space-y-2">
          <p className="text-sm text-muted-foreground">
            {step.prerequisites.length > 0
              ? `Menunggu: ${step.prerequisites.join(", ")}`
              : "Terkunci"}
          </p>
          {(step.incomingNotes?.length ?? 0) > 0 && (
            <IncomingStepNotes notes={step.incomingNotes ?? []} compact />
          )}
        </div>
      )}
    </div>
  )
}

function PrerequisiteChip({
  step,
  project,
}: {
  step: StepTimelineItem
  project: ProjectDetail
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-background p-3",
        step.status === "active" && "border-primary/30 ring-1 ring-primary/15",
        step.status === "done" && "border-primary/20 bg-primary/[0.03]"
      )}
    >
      <div className="flex items-start gap-2">
        <StepTimelineStatusIcon status={step.status} className="size-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold">
            {step.code}{" "}
            <span className="font-normal text-muted-foreground">· {step.divisionLabel}</span>
          </p>
          <p className="mt-0.5 text-xs leading-snug">{step.name}</p>
          {step.status === "done" && step.completedAt && (
            <p className="mt-1 text-[10px] text-muted-foreground">
              Selesai {formatDateTime(step.completedAt)}
            </p>
          )}
          {step.status === "active" && (
            <StepActiveBody project={project} step={step} compact />
          )}
        </div>
      </div>
    </div>
  )
}

export function StepConvergenceBlock({
  project,
  target,
  prerequisites,
}: {
  project: ProjectDetail
  target: StepTimelineItem
  prerequisites: StepTimelineItem[]
}) {
  const byCode = new Map([...prerequisites, target].map((s) => [s.code, s]))
  const pending = pendingPrerequisitesInStage(target, byCode)

  return (
    <div
      className={cn(
        "min-w-0 flex-1 overflow-hidden rounded-xl border border-dashed border-primary/25 bg-muted/10 border-l-4",
        DIVISION_BADGE_STYLES[target.division].border
      )}
    >
      <div className="border-b border-primary/10 bg-primary/[0.03] px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Prasyarat untuk {target.code}
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {prerequisites.map((step) => (
            <PrerequisiteChip key={step.code} step={step} project={project} />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center py-1 text-primary/40">
        <ArrowDown className="size-4" aria-hidden />
      </div>

      <div className="px-3 pb-3">
        <StepTimelineCard project={project} step={target} nested />
        {pending.length > 0 && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Unlock setelah{" "}
            <span className="font-medium text-foreground">
              {pending.map((s) => s.code).join(" + ")}
            </span>{" "}
            selesai
          </p>
        )}
      </div>
    </div>
  )
}

export function StepTimelineRow({
  project,
  step,
  showConnector,
}: {
  project: ProjectDetail
  step: StepTimelineItem
  showConnector: boolean
}) {
  return (
    <li className="relative flex gap-4 pb-8 last:pb-0">
      {showConnector && (
        <span
          className={cn(
            "absolute top-8 left-3.5 w-px -translate-x-1/2",
            step.status === "done" ? "bg-primary/40" : "bg-border"
          )}
          style={{ height: "calc(100% - 2rem)" }}
          aria-hidden
        />
      )}
      <div className="relative z-10 mt-0.5 shrink-0">
        <StepTimelineStatusIcon status={step.status} />
      </div>
      <StepTimelineCard project={project} step={step} />
    </li>
  )
}

export function StepConvergenceRow({
  project,
  target,
  prerequisites,
  showConnector,
}: {
  project: ProjectDetail
  target: StepTimelineItem
  prerequisites: StepTimelineItem[]
  showConnector: boolean
}) {
  return (
    <li className="relative flex gap-4 pb-8 last:pb-0">
      {showConnector && (
        <span
          className="absolute top-8 left-3.5 w-px -translate-x-1/2 bg-border"
          style={{ height: "calc(100% - 2rem)" }}
          aria-hidden
        />
      )}
      <div className="relative z-10 mt-0.5 shrink-0">
        <StepTimelineStatusIcon status="locked" />
      </div>
      <StepConvergenceBlock
        project={project}
        target={target}
        prerequisites={prerequisites}
      />
    </li>
  )
}
