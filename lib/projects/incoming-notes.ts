import type { SupabaseClient } from "@supabase/supabase-js"

import type { IncomingStepNote } from "@/lib/steps/note-route-config"

export async function loadIncomingNotesByStep(
  supabase: SupabaseClient,
  projectId: string,
  steps: { code: string; name: string }[]
): Promise<Map<string, IncomingStepNote[]>> {
  const result = await supabase
    .from("step_completions")
    .select("step_code, note_route_presence, note_route_to, note_route_message")
    .eq("project_id", projectId)
    .eq("note_route_presence", "ada")

  if (result.error) {
    return new Map()
  }

  const nameByCode = new Map(steps.map((step) => [step.code, step.name]))
  const byTarget = new Map<string, IncomingStepNote[]>()

  for (const row of result.data ?? []) {
    const to = typeof row.note_route_to === "string" ? row.note_route_to.trim() : ""
    const message =
      typeof row.note_route_message === "string" ? row.note_route_message.trim() : ""
    const from = typeof row.step_code === "string" ? row.step_code : ""
    if (!to || !from || !message) continue
    const list = byTarget.get(to) ?? []
    list.push({
      fromStep: from,
      fromName: nameByCode.get(from) ?? from,
      message,
    })
    byTarget.set(to, list)
  }

  return byTarget
}

export async function loadIncomingNotesForProjects(
  supabase: SupabaseClient,
  projectIds: string[],
  steps: { code: string; name: string }[]
): Promise<Map<string, Map<string, IncomingStepNote[]>>> {
  const empty = new Map<string, Map<string, IncomingStepNote[]>>()
  if (projectIds.length === 0) return empty

  const result = await supabase
    .from("step_completions")
    .select(
      "project_id, step_code, note_route_presence, note_route_to, note_route_message"
    )
    .in("project_id", projectIds)
    .eq("note_route_presence", "ada")

  if (result.error) return empty

  const nameByCode = new Map(steps.map((step) => [step.code, step.name]))
  const byProject = new Map<string, Map<string, IncomingStepNote[]>>()

  for (const row of result.data ?? []) {
    const projectId = typeof row.project_id === "string" ? row.project_id : ""
    const to = typeof row.note_route_to === "string" ? row.note_route_to.trim() : ""
    const message =
      typeof row.note_route_message === "string" ? row.note_route_message.trim() : ""
    const from = typeof row.step_code === "string" ? row.step_code : ""
    if (!projectId || !to || !from || !message) continue
    const byTarget = byProject.get(projectId) ?? new Map<string, IncomingStepNote[]>()
    const list = byTarget.get(to) ?? []
    list.push({
      fromStep: from,
      fromName: nameByCode.get(from) ?? from,
      message,
    })
    byTarget.set(to, list)
    byProject.set(projectId, byTarget)
  }

  return byProject
}
