import type { SupabaseClient } from "@supabase/supabase-js"

import { todayDateKeyWib } from "@/lib/format"

export type DelayResponseStatus =
  | "awaiting_division"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "cancelled"

export type DelayResponseRequest = {
  id: string
  projectId: string
  stepCode: string
  status: DelayResponseStatus
  adminNote: string | null
  pushedAt: string
  reason: string | null
  requestedUntil: string | null
  respondedAt: string | null
  reviewNote: string | null
  approvedUntil: string | null
  reviewedAt: string | null
}

type DelayResponseRow = {
  id: string
  project_id: string
  step_code: string
  status: DelayResponseStatus
  admin_note: string | null
  pushed_at: string
  reason: string | null
  requested_until: string | null
  responded_at: string | null
  review_note: string | null
  approved_until: string | null
  reviewed_at: string | null
}

function mapRow(row: DelayResponseRow): DelayResponseRequest {
  return {
    id: row.id,
    projectId: row.project_id,
    stepCode: row.step_code,
    status: row.status,
    adminNote: row.admin_note,
    pushedAt: row.pushed_at,
    reason: row.reason,
    requestedUntil: row.requested_until,
    respondedAt: row.responded_at,
    reviewNote: row.review_note,
    approvedUntil: row.approved_until,
    reviewedAt: row.reviewed_at,
  }
}

const SELECT_COLS =
  "id, project_id, step_code, status, admin_note, pushed_at, reason, requested_until, responded_at, review_note, approved_until, reviewed_at"

/** Open request (awaiting division or approval) keyed by projectId::stepCode. */
export async function loadOpenDelayResponses(
  supabase: SupabaseClient,
  projectIds: string[]
): Promise<Map<string, DelayResponseRequest>> {
  const map = new Map<string, DelayResponseRequest>()
  if (projectIds.length === 0) return map

  const { data, error } = await supabase
    .from("delay_response_requests")
    .select(SELECT_COLS)
    .in("project_id", projectIds)
    .in("status", ["awaiting_division", "awaiting_approval"])

  if (error || !data) return map

  for (const row of data as DelayResponseRow[]) {
    map.set(`${row.project_id}::${row.step_code}`, mapRow(row))
  }
  return map
}

/**
 * Latest approved grace deadline still in effect (approved_until >= today WIB).
 * Keyed by projectId::stepCode.
 */
export async function loadActiveApprovedUntil(
  supabase: SupabaseClient,
  projectIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (projectIds.length === 0) return map

  const today = todayDateKeyWib()
  const { data, error } = await supabase
    .from("delay_response_requests")
    .select("project_id, step_code, approved_until, reviewed_at")
    .in("project_id", projectIds)
    .eq("status", "approved")
    .gte("approved_until", today)
    .order("reviewed_at", { ascending: false })

  if (error || !data) return map

  for (const row of data as {
    project_id: string
    step_code: string
    approved_until: string | null
  }[]) {
    if (!row.approved_until) continue
    const key = `${row.project_id}::${row.step_code}`
    if (!map.has(key)) map.set(key, row.approved_until)
  }
  return map
}

export function delayResponseKey(projectId: string, stepCode: string): string {
  return `${projectId}::${stepCode}`
}
