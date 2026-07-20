/** Token-based partial match — every word in query must appear somewhere in haystack. */
export function matchesTokenSearch(haystack: string, query: string): boolean {
  const normalizedHaystack = haystack.toLowerCase()
  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)

  if (tokens.length === 0) return true
  return tokens.every((token) => normalizedHaystack.includes(token))
}

export function buildProjectSearchHaystack(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(" ")
}
