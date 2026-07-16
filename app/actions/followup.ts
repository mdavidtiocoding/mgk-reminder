"use server"

import { revalidatePath } from "next/cache"

import { todayDateKeyWib } from "@/lib/format"
import { createFollowUpCalendarEvents } from "@/lib/google/calendar"
import { computeProjectSteps } from "@/lib/projects/active-steps"
import { getStep } from "@/lib/steps"
import { createClient } from "@/lib/supabase/server"

export type FollowUpActionResult =
  | { success: true }
  | { success: false; error: string }

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export async function setFollowUp(
  projectId: string,
  stepCode: string,
  scheduledDate: string,
  scheduledTime: string,
  note?: string
): Promise<FollowUpActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Silakan login terlebih dahulu." }
  }

  const step = getStep(stepCode)
  if (!step) {
    return { success: false, error: "Step tidak dikenali." }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
    return { success: false, error: "Tanggal follow-up tidak valid." }
  }

  if (!TIME_PATTERN.test(scheduledTime)) {
    return { success: false, error: "Jam follow-up tidak valid." }
  }

  const today = todayDateKeyWib()
  if (scheduledDate < today) {
    return { success: false, error: "Tanggal follow-up tidak boleh di masa lalu." }
  }

  if (scheduledDate === today) {
    const nowWib = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date())
    if (scheduledTime <= nowWib) {
      return {
        success: false,
        error: "Jam follow-up hari ini harus di masa depan.",
      }
    }
  }

  const { data: project } = await supabase
    .from("projects")
    .select("status, created_at, ex_work_date, etd_date, eta_date, mos_date")
    .eq("id", projectId)
    .single()

  if (!project || project.status !== "active") {
    return { success: false, error: "Project tidak aktif." }
  }

  const { data: completionRows } = await supabase
    .from("step_completions")
    .select("step_code, completed_at")
    .eq("project_id", projectId)

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
    }
  )
  const isActive = computedSteps.some(
    (s) => s.definition.code === stepCode && s.status === "active"
  )

  if (!isActive) {
    return { success: false, error: "Hanya bisa set follow-up untuk step aktif." }
  }

  const { error } = await supabase.from("followup_schedule").upsert(
    {
      project_id: projectId,
      step_code: stepCode,
      scheduled_date: scheduledDate,
      scheduled_time: `${scheduledTime}:00`,
      note: note?.trim() || null,
      created_by: user.id,
      notified_at: null,
    },
    { onConflict: "project_id,step_code" }
  )

  if (error) {
    return { success: false, error: error.message }
  }

  await createFollowUpCalendarEvents({
    projectId,
    stepCode,
    scheduledDate,
    scheduledTime: `${scheduledTime}:00`,
    note,
    actingUserId: user.id,
  })

  revalidatePath(`/projects/${projectId}`)
  return { success: true }
}
