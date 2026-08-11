"use client"

import { Button } from "@/components/ui/button"
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
  /** false = checkboxes only, no per-item note. Default true. */
  allowItemNotes?: boolean
}

function isChoiceItem(item: string): boolean {
  return /ya\s*\/\s*tidak/i.test(item)
}

export function StepChecklistFields({
  checklist,
  checkedItems,
  checklistItemNotes,
  onToggleItem,
  onItemNoteChange,
  compact = false,
  allowItemNotes = true,
}: StepChecklistFieldsProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label className={compact ? "text-xs" : undefined}>Checklist</Label>
      <p className="text-xs text-muted-foreground">
        {allowItemNotes
          ? "Centang item yang sudah OK. Yang tidak dicentang wajib isi keterangan."
          : "Semua item wajib dicentang."}
      </p>
      <div
        className={`flex flex-col gap-3 rounded-lg border bg-background p-3 ${compact ? "gap-2 p-2.5" : ""}`}
      >
        {checklist.map((item) => {
          const checked = checkedItems.has(item)
          const note = checklistItemNotes[item] ?? ""
          const choice = isChoiceItem(item)

          if (choice) {
            const label = item.replace(/\s*:?\s*Ya\s*\/\s*Tidak/i, "").trim() || item
            return (
              <div key={item} className="flex flex-col gap-1.5">
                <p className={compact ? "text-xs font-medium" : "text-sm font-medium"}>
                  {label}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={note === "Ya" || checked ? "default" : "outline"}
                    onClick={() => {
                      if (!checked) onToggleItem(item)
                      onItemNoteChange(item, "Ya")
                    }}
                  >
                    Ya
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={note === "Tidak" ? "default" : "outline"}
                    onClick={() => {
                      if (checked) onToggleItem(item)
                      onItemNoteChange(item, "Tidak")
                    }}
                  >
                    Tidak
                  </Button>
                </div>
              </div>
            )
          }

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
              {allowItemNotes && !checked && (
                <Input
                  placeholder="Keterangan (wajib jika tidak dicentang)"
                  value={note}
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
