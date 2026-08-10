"use server"

import { revalidatePath } from "next/cache"

import { assertPermission } from "@/lib/auth/require-permission"
import { createClient } from "@/lib/supabase/server"

export type AdhocActionResult =
  | { success: true }
  | { success: false; error: string }

async function assertCanManageAdhoc(projectId: string) {
  const auth = await assertPermission("manage_adhoc")
  if (!auth.ok) {
    return { ok: false as const, error: auth.error }
  }

  const { data: project } = await auth.ctx.supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .single()

  if (!project) {
    return { ok: false as const, error: "Project tidak ditemukan." }
  }

  return {
    ok: true as const,
    userId: auth.ctx.user.id,
    supabase: auth.ctx.supabase,
  }
}

export async function createAdhocCase(
  projectId: string,
  description: string
): Promise<AdhocActionResult> {
  const auth = await assertCanManageAdhoc(projectId)
  if (!auth.ok) return { success: false, error: auth.error }

  const trimmed = description.trim()
  if (!trimmed) {
    return { success: false, error: "Deskripsi wajib diisi." }
  }

  const { error } = await auth.supabase.from("adhoc_cases").insert({
    project_id: projectId,
    description: trimmed,
    created_by: auth.userId,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath(`/projects/${projectId}`)
  return { success: true }
}

export async function resolveAdhocCase(
  caseId: string,
  projectId: string,
  note?: string
): Promise<AdhocActionResult> {
  const auth = await assertCanManageAdhoc(projectId)
  if (!auth.ok) return { success: false, error: auth.error }

  const { error } = await auth.supabase
    .from("adhoc_cases")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      note: note?.trim() || null,
    })
    .eq("id", caseId)
    .eq("status", "open")

  if (error) return { success: false, error: error.message }

  revalidatePath(`/projects/${projectId}`)
  return { success: true }
}

export async function getAdhocCases(projectId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("adhoc_cases")
    .select(
      `
      id,
      description,
      status,
      created_at,
      resolved_at,
      note,
      profiles(name)
    `
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })

  return (data ?? []).map((row) => ({
    id: row.id,
    description: row.description,
    status: row.status as "open" | "resolved",
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    note: row.note,
    createdByName: Array.isArray(row.profiles)
      ? row.profiles[0]?.name
      : (row.profiles as { name: string } | null)?.name,
  }))
}
