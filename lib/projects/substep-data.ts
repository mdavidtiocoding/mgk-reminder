import type { SupabaseClient } from "@supabase/supabase-js"

import type { SubstepCompletion } from "@/lib/steps/substeps"

type SubstepRow = {
  project_id: string
  step_code: string
  substep_key: string
  completed_at: string
  completed_by?: string
  note?: string | null
  event_date?: string | null
  profile?: { name: string } | { name: string }[] | null
}

function normalizeProfile(
  profile: SubstepRow["profile"]
): { name: string } | null {
  if (!profile) return null
  if (Array.isArray(profile)) return profile[0] ?? null
  return profile
}

function mapRow(row: SubstepRow): SubstepCompletion & { projectId: string } {
  return {
    projectId: row.project_id,
    stepCode: row.step_code,
    substepKey: row.substep_key,
    completedAt: row.completed_at,
    completedBy: row.completed_by,
    completedByName: normalizeProfile(row.profile)?.name ?? null,
    note: row.note,
    eventDate: row.event_date ?? null,
  }
}

/** Safe loader — returns empty when migration belum dijalankan. */
export async function loadSubstepCompletionsMap(
  supabase: SupabaseClient,
  projectIds?: string[]
): Promise<Map<string, SubstepCompletion[]>> {
  try {
    const buildQuery = (select: string) => {
      let query = supabase.from("step_substep_completions").select(select)
      if (projectIds && projectIds.length > 0) {
        query = query.in("project_id", projectIds)
      }
      return query
    }

    const withEventDate = await buildQuery(
      "project_id, step_code, substep_key, completed_at, completed_by, note, event_date, profile:profiles(name)"
    )

    const { data, error } = withEventDate.error
      ? await buildQuery(
          "project_id, step_code, substep_key, completed_at, completed_by, note, profile:profiles(name)"
        )
      : withEventDate

    if (error) {
      console.warn("loadSubstepCompletionsMap:", error.message)
      return new Map()
    }

    const map = new Map<string, SubstepCompletion[]>()
    for (const row of (data ?? []) as unknown as SubstepRow[]) {
      const mapped = mapRow(row)
      const list = map.get(mapped.projectId) ?? []
      list.push(mapped)
      map.set(mapped.projectId, list)
    }
    return map
  } catch {
    return new Map()
  }
}

export async function loadSubstepCompletionsForProject(
  supabase: SupabaseClient,
  projectId: string
): Promise<SubstepCompletion[]> {
  const map = await loadSubstepCompletionsMap(supabase, [projectId])
  return map.get(projectId) ?? []
}
