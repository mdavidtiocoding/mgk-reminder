import type { SupabaseClient } from "@supabase/supabase-js"

import { createServiceClient } from "@/lib/supabase/admin"

function applyRows(
  names: Map<string, string>,
  rows: Array<{ id: string; name: string | null; email: string | null }>
) {
  for (const row of rows) {
    const label = row.name?.trim() || row.email?.trim()
    if (label) names.set(row.id, label)
  }
}

/** Map user id → display name (profiles.name, fallback email). */
export async function loadProfileDisplayNames(
  supabase: SupabaseClient,
  userIds: Array<string | null | undefined>
): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))]
  const names = new Map<string, string>()
  if (ids.length === 0) return names

  const { data } = await supabase
    .from("profiles")
    .select("id, name, email")
    .in("id", ids)

  applyRows(names, data ?? [])

  const missing = ids.filter((id) => !names.has(id))
  if (missing.length === 0) return names

  const service = createServiceClient()
  if (!service) return names

  const { data: extra } = await service
    .from("profiles")
    .select("id, name, email")
    .in("id", missing)

  applyRows(names, extra ?? [])
  return names
}
