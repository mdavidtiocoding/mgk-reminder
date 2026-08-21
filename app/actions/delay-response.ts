"use server"

import { revalidatePath } from "next/cache"

import { isUserAdmin, resolveUserDivisions, userCanWorkDivision } from "@/lib/auth/user-divisions"
import { todayDateKeyWib } from "@/lib/format"
import { createFollowUpCalendarEvents } from "@/lib/google/calendar"
import {
  notifyAdminsDelaySubmitted,
  notifyDivisionForStep,
} from "@/lib/notifications/send"
import { computeProjectSteps } from "@/lib/projects/active-steps"
import { loadRuntimeSteps } from "@/lib/steps/runtime-config"
import { createClient } from "@/lib/supabase/server"

export type DelayResponseActionResult =
  | { success: true }
  | { success: false; error: string }

async function loadActiveStepContext(projectId: string, stepCode: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false as const, error: "Silakan login terlebih dahulu." }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, division, divisions")
    .eq("id", user.id)
    .single()

  const userDivisions = resolveUserDivisions(profile)
  const runtimeSteps = await loadRuntimeSteps(supabase)
  const step = runtimeSteps.find((s) => s.code === stepCode)
  if (!step) {
    return { ok: false as const, error: "Step tidak dikenali." }
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, status, created_at, ex_work_date, etd_date, eta_date, mos_date")
    .eq("id", projectId)
    .single()

  if (!project || project.status !== "active") {
    return { ok: false as const, error: "Project tidak aktif." }
  }

  const [{ data: completionRows }, { data: substepRows }] = await Promise.all([
    supabase
      .from("step_completions")
      .select("step_code, completed_at")
      .eq("project_id", projectId),
    supabase
      .from("step_substep_completions")
      .select("step_code, substep_key, completed_at")
      .eq("project_id", projectId),
  ])

  const computedSteps = computeProjectSteps(
    (completionRows ?? []).map((row) => ({
      stepCode: row.step_code as string,
      completedAt: row.completed_at as string,
    })),
    {
      createdAt: project.created_at,
      ex_work_date: project.ex_work_date,
      etd_date: project.etd_date,
      eta_date: project.eta_date,
      mos_date: project.mos_date,
    },
    {
      steps: runtimeSteps,
      substepCompletions: (substepRows ?? []).map((row) => ({
        stepCode: row.step_code as string,
        substepKey: row.substep_key as string,
        completedAt: row.completed_at as string,
      })),
    }
  )

  const isActive = computedSteps.some(
    (s) => s.definition.code === stepCode && s.status === "active"
  )
  if (!isActive) {
    return { ok: false as const, error: "Hanya untuk step yang sedang aktif." }
  }

  return {
    ok: true as const,
    supabase,
    user,
    userDivisions,
    step,
    project,
  }
}

/** Admin: minta divisi isi alasan delay + minta waktu. */
export async function pushDelayResponse(
  projectId: string,
  stepCode: string,
  adminNote?: string
): Promise<DelayResponseActionResult> {
  const ctx = await loadActiveStepContext(projectId, stepCode)
  if (!ctx.ok) return { success: false, error: ctx.error }

  const { supabase, user, userDivisions, project } = ctx
  if (!isUserAdmin(userDivisions)) {
    return { success: false, error: "Hanya admin yang bisa minta response." }
  }

  const { data: open } = await supabase
    .from("delay_response_requests")
    .select("id, status")
    .eq("project_id", projectId)
    .eq("step_code", stepCode)
    .in("status", ["awaiting_division", "awaiting_approval"])
    .maybeSingle()

  if (open) {
    return {
      success: false,
      error:
        open.status === "awaiting_approval"
          ? "Sudah ada response menunggu approve."
          : "Sudah menunggu response dari divisi.",
    }
  }

  const { error } = await supabase.from("delay_response_requests").insert({
    project_id: projectId,
    step_code: stepCode,
    status: "awaiting_division",
    pushed_by: user.id,
    admin_note: adminNote?.trim() || null,
  })

  if (error) {
    if (error.message.includes("delay_response_requests")) {
      return {
        success: false,
        error:
          "Tabel delay_response_requests belum ada — jalankan database/add-delay-response-requests.sql",
      }
    }
    return { success: false, error: error.message }
  }

  await notifyDivisionForStep({
    projectId,
    projectName: project.name,
    stepCode,
    type: "delay_push",
    adminNote: adminNote?.trim() || null,
  })

  revalidatePath("/tasks")
  revalidatePath(`/projects/${projectId}`)
  return { success: true }
}

/** Divisi: kirim alasan + minta sampai tanggal. */
export async function submitDelayResponse(
  projectId: string,
  stepCode: string,
  reason: string,
  requestedUntil: string
): Promise<DelayResponseActionResult> {
  const ctx = await loadActiveStepContext(projectId, stepCode)
  if (!ctx.ok) return { success: false, error: ctx.error }

  const { supabase, user, userDivisions, step, project } = ctx
  if (!userCanWorkDivision(userDivisions, step.division)) {
    return {
      success: false,
      error: "Hanya tim divisi PIC yang bisa mengisi response.",
    }
  }

  const trimmed = reason.trim()
  if (trimmed.length < 5) {
    return { success: false, error: "Alasan delay minimal 5 karakter." }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedUntil)) {
    return { success: false, error: "Tanggal tidak valid." }
  }
  if (requestedUntil < todayDateKeyWib()) {
    return { success: false, error: "Tanggal harus hari ini atau ke depan." }
  }

  const { data: open } = await supabase
    .from("delay_response_requests")
    .select("id, status")
    .eq("project_id", projectId)
    .eq("step_code", stepCode)
    .eq("status", "awaiting_division")
    .maybeSingle()

  if (!open) {
    return {
      success: false,
      error: "Tidak ada permintaan response yang menunggu dari admin.",
    }
  }

  const { error } = await supabase
    .from("delay_response_requests")
    .update({
      status: "awaiting_approval",
      reason: trimmed,
      requested_until: requestedUntil,
      responded_by: user.id,
      responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", open.id)

  if (error) return { success: false, error: error.message }

  await notifyAdminsDelaySubmitted({
    projectId,
    projectName: project.name,
    stepCode,
    delayReason: trimmed,
    requestedUntil,
  })

  revalidatePath("/tasks")
  revalidatePath(`/projects/${projectId}`)
  return { success: true }
}

/** Admin: approve atau tolak. */
export async function reviewDelayResponse(
  projectId: string,
  stepCode: string,
  decision: "approved" | "rejected",
  reviewNote?: string
): Promise<DelayResponseActionResult> {
  const ctx = await loadActiveStepContext(projectId, stepCode)
  if (!ctx.ok) return { success: false, error: ctx.error }

  const { supabase, user, userDivisions, project } = ctx
  if (!isUserAdmin(userDivisions)) {
    return { success: false, error: "Hanya admin yang bisa approve." }
  }

  const { data: open } = await supabase
    .from("delay_response_requests")
    .select("id, status, requested_until, reason")
    .eq("project_id", projectId)
    .eq("step_code", stepCode)
    .eq("status", "awaiting_approval")
    .maybeSingle()

  if (!open) {
    return { success: false, error: "Tidak ada response menunggu approve." }
  }

  if (decision === "approved" && !open.requested_until) {
    return { success: false, error: "Tanggal permintaan tidak ada." }
  }

  const approvedUntil =
    decision === "approved" ? (open.requested_until as string) : null

  const { error } = await supabase
    .from("delay_response_requests")
    .update({
      status: decision,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_note: reviewNote?.trim() || null,
      approved_until: approvedUntil,
      updated_at: new Date().toISOString(),
    })
    .eq("id", open.id)

  if (error) return { success: false, error: error.message }

  if (decision === "approved" && approvedUntil) {
    await createFollowUpCalendarEvents({
      projectId,
      stepCode,
      scheduledDate: approvedUntil,
      scheduledTime: "09:00:00",
      note:
        open.reason?.trim() ||
        reviewNote?.trim() ||
        "Perpanjangan waktu delay disetujui admin",
      actingUserId: user.id,
    })

    await supabase.from("followup_schedule").upsert(
      {
        project_id: projectId,
        step_code: stepCode,
        scheduled_date: approvedUntil,
        scheduled_time: "09:00:00",
        note:
          open.reason?.trim() ||
          reviewNote?.trim() ||
          "Perpanjangan waktu delay disetujui admin",
        created_by: user.id,
        notified_at: null,
      },
      { onConflict: "project_id,step_code" }
    )
  }

  await notifyDivisionForStep({
    projectId,
    projectName: project.name,
    stepCode,
    type: "delay_reviewed",
    reviewDecision: decision,
    approvedUntil,
    reviewNote: reviewNote?.trim() || null,
  })

  revalidatePath("/tasks")
  revalidatePath(`/projects/${projectId}`)
  return { success: true }
}
