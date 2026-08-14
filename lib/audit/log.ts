import { createServiceClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export type AuditAction =
  | "project.create"
  | "project.update"
  | "project.status"
  | "project.delete"
  | "step.complete"
  | "step.undo"
  | "substep.complete"
  | "substep.undo"
  | "adhoc.create"
  | "adhoc.resolve"
  | "user.create"
  | "user.update_name"
  | "user.update_divisions"
  | "user.update_status"
  | "user.delete"
  | "permissions.update"
  | "flow.update"

export type WriteAuditLogInput = {
  actorId?: string | null
  actorName?: string | null
  action: AuditAction | string
  summary: string
  entityType?: string
  entityId?: string | null
  projectId?: string | null
  meta?: Record<string, unknown>
}

/**
 * Best-effort audit write — never throws to callers.
 * Prefers service role so RLS never blocks the log.
 */
export async function writeAuditLog(input: WriteAuditLogInput): Promise<void> {
  try {
    const row = {
      actor_id: input.actorId ?? null,
      actor_name: input.actorName?.trim() || null,
      action: input.action,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      project_id: input.projectId ?? null,
      summary: input.summary.trim().slice(0, 500),
      meta: input.meta ?? null,
    }

    const service = createServiceClient()
    if (service) {
      const { error } = await service.from("audit_logs").insert(row)
      if (error) {
        console.error("[audit]", error.message)
      }
      return
    }

    const supabase = await createClient()
    const { error } = await supabase.from("audit_logs").insert(row)
    if (error) {
      console.error("[audit]", error.message)
    }
  } catch (err) {
    console.error("[audit]", err)
  }
}

export async function resolveActorName(
  userId: string,
  fallback?: string | null
): Promise<string> {
  try {
    const service = createServiceClient()
    const client = service ?? (await createClient())
    const { data } = await client
      .from("profiles")
      .select("name, email")
      .eq("id", userId)
      .maybeSingle()
    return data?.name?.trim() || data?.email || fallback || "User"
  } catch {
    return fallback || "User"
  }
}
