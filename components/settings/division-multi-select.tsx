"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { DIVISION_LABELS, type Division } from "@/lib/steps"
import { cn } from "@/lib/utils"

type DivisionMultiSelectProps = {
  value: Division[]
  onChange: (divisions: Division[]) => void
  disabled?: boolean
  className?: string
  /** Hide admin unless explicitly needed (e.g. create admin user). */
  includeAdmin?: boolean
}

const ALL_DIVISIONS = Object.keys(DIVISION_LABELS) as Division[]

export function DivisionMultiSelect({
  value,
  onChange,
  disabled = false,
  className,
  includeAdmin = true,
}: DivisionMultiSelectProps) {
  const options = includeAdmin
    ? ALL_DIVISIONS
    : ALL_DIVISIONS.filter((d) => d !== "admin")

  function toggle(division: Division, checked: boolean) {
    if (checked) {
      onChange([...new Set([...value, division])])
      return
    }
    onChange(value.filter((d) => d !== division))
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {options.map((division) => {
        const id = `division-${division}`
        const checked = value.includes(division)

        return (
          <div key={division} className="flex items-center gap-2">
            <Checkbox
              id={id}
              checked={checked}
              disabled={disabled}
              onCheckedChange={(next) => toggle(division, next === true)}
            />
            <Label htmlFor={id} className="cursor-pointer font-normal">
              {DIVISION_LABELS[division]}
            </Label>
          </div>
        )
      })}
    </div>
  )
}

export function formatDivisionSelection(divisions: Division[]): string {
  if (divisions.length === 0) return "Belum ada divisi"
  return divisions.map((d) => DIVISION_LABELS[d]).join(", ")
}
