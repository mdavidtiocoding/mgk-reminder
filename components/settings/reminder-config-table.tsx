"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil } from "lucide-react"

import { updateReminderConfig, updateStepDefinitionName } from "@/app/actions/settings"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  DIVISION_BADGE_STYLES,
  describeTrigger,
  getDivisionLabel,
  getStep,
} from "@/lib/steps"
import { cn } from "@/lib/utils"

export type ReminderConfigRow = {
  step_code: string
  name: string
  enabled: boolean
  repeat_days: number | null
  max_repeats: number | null
  notify_channel: string
}

type ReminderConfigUpdate = Parameters<typeof updateReminderConfig>[1]

const CHANNEL_LABELS: Record<string, string> = {
  all: "All",
  email: "Email",
  push: "Push",
  calendar: "Calendar",
}

export function ReminderConfigTable({ configs }: { configs: ReminderConfigRow[] }) {
  const router = useRouter()
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
    toastTimer.current = setTimeout(() => setToast(null), 1800)
  }

  async function handleSave(stepCode: string, updates: ReminderConfigUpdate) {
    const result = await updateReminderConfig(stepCode, updates)
    if (result?.success) {
      showToast("Tersimpan")
      router.refresh()
    } else {
      showToast(result?.error ? `Gagal: ${result.error}` : "Gagal menyimpan")
    }
  }

  async function handleRename(stepCode: string, name: string) {
    const result = await updateStepDefinitionName(stepCode, name)
    if (result?.success) {
      setNameOverrides((prev) => ({ ...prev, [stepCode]: name }))
      showToast("Tersimpan")
    } else {
      showToast(result?.error ? `Gagal: ${result.error}` : "Gagal menyimpan")
    }
    return result?.success ?? false
  }

  if (configs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Belum ada reminder config.</p>
    )
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th className="px-3 py-2 font-medium">Step</th>
              <th className="px-3 py-2 font-medium">Divisi</th>
              <th className="px-3 py-2 font-medium">Trigger</th>
              <th className="px-3 py-2 text-center font-medium">Enabled</th>
              <th className="px-3 py-2 font-medium">Repeat (hari)</th>
              <th className="px-3 py-2 font-medium">Max repeat</th>
              <th className="px-3 py-2 font-medium">Channel</th>
            </tr>
          </thead>
          <tbody>
            {configs.map((config) => (
              <ReminderConfigTableRow
                key={config.step_code}
                config={config}
                displayName={nameOverrides[config.step_code] ?? config.name}
                onSave={handleSave}
                onRename={handleRename}
              />
            ))}
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

function ReminderConfigTableRow({
  config,
  displayName,
  onSave,
  onRename,
}: {
  config: ReminderConfigRow
  displayName: string
  onSave: (stepCode: string, updates: ReminderConfigUpdate) => Promise<void>
  onRename: (stepCode: string, name: string) => Promise<boolean>
}) {
  const [isPending, startTransition] = useTransition()
  const step = getStep(config.step_code)

  function save(updates: ReminderConfigUpdate) {
    startTransition(async () => {
      await onSave(config.step_code, updates)
    })
  }

  return (
    <tr className="border-b align-top last:border-b-0">
      <td className="px-3 py-2">
        <p className="text-xs text-muted-foreground">{config.step_code}</p>
        <StepNameCell
          stepCode={config.step_code}
          name={displayName}
          onRename={onRename}
        />
      </td>
      <td className="px-3 py-2">
        {step ? (
          <span
            className={cn(
              "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap",
              DIVISION_BADGE_STYLES[step.division].badge
            )}
          >
            {getDivisionLabel(step.division)}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground italic">
        {step ? describeTrigger(step) : "—"}
      </td>
      <td className="px-3 py-2 text-center">
        <Switch
          checked={config.enabled}
          onCheckedChange={(checked) => save({ enabled: checked === true })}
          disabled={isPending}
        />
      </td>
      <td className="px-3 py-2">
        <Input
          type="number"
          min={1}
          placeholder="—"
          defaultValue={config.repeat_days ?? ""}
          className="h-8 w-24"
          disabled={isPending}
          onBlur={(e) => {
            const raw = e.target.value.trim()
            if (raw === "") {
              save({ repeat_days: null })
              return
            }
            const days = parseInt(raw, 10)
            if (!isNaN(days) && days >= 1) {
              save({ repeat_days: days })
            }
          }}
        />
      </td>
      <td className="px-3 py-2">
        <Input
          type="number"
          min={1}
          placeholder="∞"
          defaultValue={config.max_repeats ?? ""}
          className="h-8 w-24"
          disabled={isPending}
          onBlur={(e) => {
            const raw = e.target.value.trim()
            if (raw === "") {
              save({ max_repeats: null })
              return
            }
            const n = parseInt(raw, 10)
            if (!isNaN(n) && n >= 1) {
              save({ max_repeats: n })
            }
          }}
        />
      </td>
      <td className="px-3 py-2">
        <Select
          value={config.notify_channel}
          onValueChange={(v) =>
            save({
              notify_channel: v as "all" | "email" | "push" | "calendar",
            })
          }
          disabled={isPending}
        >
          <SelectTrigger className="h-8 w-full max-w-[140px]" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4} className="z-[100]">
            {Object.entries(CHANNEL_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
    </tr>
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
    // Escape triggers a native blur when the input unmounts; suppress the
    // blur-triggered commit() that would otherwise immediately follow.
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
