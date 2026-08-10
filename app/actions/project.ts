"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { resolveActorName, writeAuditLog } from "@/lib/audit/log"
import { assertPermission } from "@/lib/auth/require-permission"
import type { ProjectStatus } from "@/lib/steps"

export type ProjectActionResult =
  | { success: true }
  | { success: false; error: string }

export async function updateProject(input: {
  projectId: string
  name: string
  customerId?: string | null
  newCustomerName?: string | null
}): Promise<ProjectActionResult> {
  const auth = await assertPermission("edit_project")
  if (!auth.ok) return { success: false, error: auth.error }
  const { supabase, user, profile } = auth.ctx

  const name = input.name.trim()
  if (!name) return { success: false, error: "Nama project wajib diisi." }

  let customerId = input.customerId?.trim() || null
  const newCustomerName = input.newCustomerName?.trim() || null

  if (newCustomerName) {
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .insert({ name: newCustomerName })
      .select("id")
      .single()

    if (customerError) return { success: false, error: customerError.message }
    customerId = customer.id
  }

  if (!customerId) {
    return { success: false, error: "Pilih customer atau tambah customer baru." }
  }

  const { error } = await supabase
    .from("projects")
    .update({ name, customer_id: customerId })
    .eq("id", input.projectId)

  if (error) return { success: false, error: error.message }

  const actorName = await resolveActorName(user.id, profile?.name ?? user.email)
  await writeAuditLog({
    actorId: user.id,
    actorName,
    action: "project.update",
    summary: `Edit project → “${name}”`,
    entityType: "project",
    entityId: input.projectId,
    projectId: input.projectId,
  })

  revalidatePath("/")
  revalidatePath(`/projects/${input.projectId}`)
  revalidatePath("/tasks")
  return { success: true }
}

export async function updateProjectStatus(
  projectId: string,
  status: ProjectStatus
): Promise<ProjectActionResult> {
  const auth = await assertPermission("change_project_status")
  if (!auth.ok) return { success: false, error: auth.error }

  if (!["active", "on_hold", "completed"].includes(status)) {
    return { success: false, error: "Status tidak valid." }
  }

  const { data: before } = await auth.ctx.supabase
    .from("projects")
    .select("name, status")
    .eq("id", projectId)
    .maybeSingle()

  const { error } = await auth.ctx.supabase
    .from("projects")
    .update({ status })
    .eq("id", projectId)

  if (error) return { success: false, error: error.message }

  const actorName = await resolveActorName(
    auth.ctx.user.id,
    auth.ctx.profile?.name ?? auth.ctx.user.email
  )
  await writeAuditLog({
    actorId: auth.ctx.user.id,
    actorName,
    action: "project.status",
    summary: `Status “${before?.name ?? projectId}”: ${before?.status ?? "?"} → ${status}`,
    entityType: "project",
    entityId: projectId,
    projectId,
    meta: { from: before?.status, to: status },
  })

  revalidatePath("/")
  revalidatePath(`/projects/${projectId}`)
  revalidatePath("/tasks")
  return { success: true }
}

export async function deleteProject(projectId: string): Promise<ProjectActionResult> {
  const auth = await assertPermission("delete_project")
  if (!auth.ok) return { success: false, error: auth.error }

  const { data: before } = await auth.ctx.supabase
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .maybeSingle()

  // .select() is required: without a DELETE RLS policy Supabase returns
  // success with 0 rows and no error — project would appear "deleted" in UI
  // but still exist in the DB.
  const { data, error } = await auth.ctx.supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .select("id")

  if (error) return { success: false, error: error.message }
  if (!data || data.length === 0) {
    return {
      success: false,
      error:
        "Gagal hapus (0 baris). Jalankan database/add-app-config.sql di Supabase SQL Editor agar policy projects_delete_admin aktif.",
    }
  }

  const actorName = await resolveActorName(
    auth.ctx.user.id,
    auth.ctx.profile?.name ?? auth.ctx.user.email
  )
  await writeAuditLog({
    actorId: auth.ctx.user.id,
    actorName,
    action: "project.delete",
    summary: `Hapus project “${before?.name ?? projectId}”`,
    entityType: "project",
    entityId: projectId,
    meta: { name: before?.name },
  })

  revalidatePath("/")
  revalidatePath("/tasks")
  redirect("/")
}
