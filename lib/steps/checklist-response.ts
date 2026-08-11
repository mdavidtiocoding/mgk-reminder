export type ChecklistItemResponse = {
  item: string
  checked: boolean
  note?: string
}

function isChoiceItem(item: string): boolean {
  return /ya\s*\/\s*tidak/i.test(item)
}

export type ChecklistCompleteOptions = {
  /** false = item must be checked (checklist-only). Default true = check or note. */
  allowItemNotes?: boolean
}

/** Checklist-only: must be checked. Checklist+keterangan: checked OR a note. */
export function isChecklistItemComplete(
  item: ChecklistItemResponse,
  options?: ChecklistCompleteOptions
): boolean {
  if (isChoiceItem(item.item)) {
    return item.checked || Boolean(item.note?.trim())
  }
  if (options?.allowItemNotes === false) {
    return item.checked
  }
  return item.checked || Boolean(item.note?.trim())
}

export function validateChecklistResponses(
  expectedItems: string[],
  responses: ChecklistItemResponse[],
  options?: ChecklistCompleteOptions
): string | null {
  const byItem = new Map(responses.map((r) => [r.item, r]))
  const allowItemNotes = options?.allowItemNotes !== false

  for (const item of expectedItems) {
    const response = byItem.get(item)
    if (!response || !isChecklistItemComplete(response, options)) {
      return allowItemNotes
        ? `Setiap item checklist harus dicentang atau diberi keterangan: "${item}".`
        : `Setiap item checklist harus dicentang: "${item}".`
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
