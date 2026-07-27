export type ChecklistItemResponse = {
  item: string
  checked: boolean
  note?: string
}

/** Each item must be checked OR have a non-empty note. */
export function isChecklistItemComplete(item: ChecklistItemResponse): boolean {
  return item.checked || Boolean(item.note?.trim())
}

export function validateChecklistResponses(
  expectedItems: string[],
  responses: ChecklistItemResponse[]
): string | null {
  const byItem = new Map(responses.map((r) => [r.item, r]))

  for (const item of expectedItems) {
    const response = byItem.get(item)
    if (!response || !isChecklistItemComplete(response)) {
      return `Setiap item checklist harus dicentang atau diberi catatan: "${item}".`
    }
  }

  return null
}

export function buildChecklistResponses(
  items: string[],
  checkedItems: string[],
  itemNotes: Record<string, string>
): ChecklistItemResponse[] {
  const checked = new Set(checkedItems)
  return items.map((item) => ({
    item,
    checked: checked.has(item),
    note: itemNotes[item]?.trim() || undefined,
  }))
}

export function formatCompletionNote(
  responses: ChecklistItemResponse[],
  generalNote?: string
): string | null {
  const lines: string[] = []

  if (responses.length > 0) {
    lines.push("Checklist:")
    for (const row of responses) {
      if (row.checked) {
        lines.push(`✓ ${row.item}`)
      } else {
        lines.push(`— ${row.item}: ${row.note?.trim()}`)
      }
    }
  }

  const trimmedGeneral = generalNote?.trim()
  if (trimmedGeneral) {
    if (lines.length > 0) lines.push("")
    lines.push(trimmedGeneral)
  }

  return lines.length > 0 ? lines.join("\n") : null
}
