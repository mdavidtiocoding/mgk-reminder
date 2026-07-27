"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type StepChecklistFieldsProps = {
  checklist: string[]
  checkedItems: Set<string>
  checklistItemNotes: Record<string, string>
  onToggleItem: (item: string) => void
  onItemNoteChange: (item: string, value: string) => void
  compact?: boolean
}

export function StepChecklistFields({
  checklist,
  checkedItems,
  checklistItemNotes,
  onToggleItem,
  onItemNoteChange,
  compact = false,
}: StepChecklistFieldsProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label className={compact ? "text-xs" : undefined}>Checklist</Label>
      <p className="text-xs text-muted-foreground">
        Centang item yang sudah OK, atau tulis catatan jika belum.
      </p>
      <div
        className={`flex flex-col gap-3 rounded-lg border bg-background p-3 ${compact ? "gap-2 p-2.5" : ""}`}
      >
        {checklist.map((item) => {
          const checked = checkedItems.has(item)
          return (
            <div key={item} className="flex flex-col gap-1.5">
              <label
                className={`flex items-center gap-2 ${compact ? "text-xs" : "text-sm"}`}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => onToggleItem(item)}
                />
                {item}
              </label>
              {!checked && (
                <Input
                  placeholder="Catatan (wajib jika tidak dicentang)"
                  value={checklistItemNotes[item] ?? ""}
                  onChange={(e) => onItemNoteChange(item, e.target.value)}
                  className={`ml-6 ${compact ? "h-8 text-xs" : "text-sm"}`}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
