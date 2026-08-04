"use client"

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
  DATE_FIELD_LABELS,
  type DateField,
  type StepTrigger,
} from "@/lib/steps"
import { TRIGGER_TYPE_LABELS } from "@/lib/steps/trigger-config"

type TriggerEditorProps = {
  value: StepTrigger
  onChange: (trigger: StepTrigger) => void
  stepOptions: { code: string; name: string }[]
  disabled?: boolean
}

export function TriggerEditor({
  value,
  onChange,
  stepOptions,
  disabled,
}: TriggerEditorProps) {
  function setType(type: StepTrigger["type"]) {
    if (type === "immediate") {
      onChange({ type: "immediate" })
      return
    }
    if (type === "interval") {
      onChange({ type: "interval", intervalDays: 1 })
      return
    }
    if (type === "after_step") {
      onChange({
        type: "after_step",
        stepCode: stepOptions[0]?.code ?? "M1",
        offsetDays: 1,
      })
      return
    }
    if (type === "before_date") {
      onChange({ type: "before_date", dateField: "eta_date", offsetDays: 3 })
      return
    }
    onChange({ type: "after_date", dateField: "etd_date", offsetDays: 1 })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Tipe trigger</Label>
        <Select
          value={value.type}
          onValueChange={(v) => setType(v as StepTrigger["type"])}
          disabled={disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(TRIGGER_TYPE_LABELS) as StepTrigger["type"][]).map(
              (type) => (
                <SelectItem key={type} value={type}>
                  {TRIGGER_TYPE_LABELS[type]}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      </div>

      {value.type === "interval" && (
        <NumberField
          label="Setiap berapa hari"
          value={value.intervalDays}
          disabled={disabled}
          onChange={(n) => onChange({ type: "interval", intervalDays: n })}
        />
      )}

      {value.type === "after_step" && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Setelah step</Label>
            <Select
              value={value.stepCode}
              onValueChange={(stepCode) =>
                onChange({ ...value, stepCode })
              }
              disabled={disabled}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stepOptions.map((opt) => (
                  <SelectItem key={opt.code} value={opt.code}>
                    {opt.code} — {opt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <NumberField
            label="Offset (hari setelah selesai)"
            value={value.offsetDays}
            disabled={disabled}
            onChange={(offsetDays) => onChange({ ...value, offsetDays })}
          />
          <NumberField
            label="Repeat tiap (hari, opsional)"
            value={value.repeatDays ?? 0}
            allowZero
            disabled={disabled}
            onChange={(repeatDays) =>
              onChange({
                ...value,
                repeatDays: repeatDays > 0 ? repeatDays : undefined,
              })
            }
          />
        </>
      )}

      {(value.type === "before_date" || value.type === "after_date") && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Tanggal project</Label>
            <Select
              value={value.dateField}
              onValueChange={(dateField) =>
                onChange({ ...value, dateField: dateField as DateField })
              }
              disabled={disabled}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(DATE_FIELD_LABELS) as DateField[]).map((field) => (
                  <SelectItem key={field} value={field}>
                    {DATE_FIELD_LABELS[field]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <NumberField
            label={
              value.type === "before_date"
                ? "Berapa hari SEBELUM tanggal"
                : "Berapa hari SETELAH tanggal"
            }
            value={value.offsetDays}
            disabled={disabled}
            onChange={(offsetDays) => onChange({ ...value, offsetDays })}
          />
          <NumberField
            label="Repeat tiap (hari, opsional)"
            value={value.repeatDays ?? 0}
            allowZero
            disabled={disabled}
            onChange={(repeatDays) =>
              onChange({
                ...value,
                repeatDays: repeatDays > 0 ? repeatDays : undefined,
              })
            }
          />
        </>
      )}

      <p className="text-[10px] text-muted-foreground">
        Contoh: S5 = 3 hari sebelum ETA → tipe &quot;sebelum tanggal&quot;, field ETA,
        offset 3. Bisa diubah kapan saja tanpa coding.
      </p>
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
  disabled,
  allowZero,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  disabled?: boolean
  allowZero?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        min={allowZero ? 0 : 0}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (!Number.isFinite(n)) return
          onChange(Math.max(allowZero ? 0 : 0, Math.floor(n)))
        }}
      />
    </div>
  )
}
