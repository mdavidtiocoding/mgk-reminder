import type { SupabaseClient } from "@supabase/supabase-js"

import { getDivisionLabel, getStep } from "@/lib/steps"
import { formatDateKey, formatFollowUpSchedule } from "@/lib/format"
import { createServiceClient } from "@/lib/supabase/admin"

import { sendEmail } from "./email"
import { sendPushToSubscriptions } from "./push-server"

type NotifyParams = {
  projectId: string
  projectName: string
  stepCode: string
  type: "step_unlock" | "reminder" | "hogger" | "followup"
  scheduledDate?: string
  scheduledTime?: string
  followUpNote?: string | null
}

async function getDivisionRecipients(
  supabase: SupabaseClient,
  division: string,
  includeAdmins = false
) {
  const { data: divisionUsers } = await supabase
    .from("profiles")
    .select("id, name, email, notif_email, notif_push")
    .eq("status", "active")
    .or(`division.eq.${division},divisions.cs.{${division}}`)

  if (!includeAdmins) {
    return divisionUsers ?? []
  }

  const { data: admins } = await supabase
    .from("profiles")
    .select("id, name, email, notif_email, notif_push")
    .eq("status", "active")
    .or("division.eq.admin,divisions.cs.{admin}")

  const merged = [...(divisionUsers ?? []), ...(admins ?? [])]
  const seen = new Set<string>()
  return merged.filter((user) => {
    if (seen.has(user.id)) return false
    seen.add(user.id)
    return true
  })
}

async function getPushSubscriptions(
  supabase: SupabaseClient,
  userIds: string[]
) {
  if (userIds.length === 0) return []

  const { data } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, user_id")
    .in("user_id", userIds)

  return data ?? []
}

async function logReminder(
  supabase: SupabaseClient,
  projectId: string,
  stepCode: string,
  channel: string
) {
  await supabase.from("reminder_log").insert({
    project_id: projectId,
    step_code: stepCode,
    channel,
  })
}

function buildMessage(params: NotifyParams, stepName: string, divisionLabel: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const projectUrl = `${appUrl}/projects/${params.projectId}`

  switch (params.type) {
    case "step_unlock":
      return {
        subject: `[MGK] Step baru: ${params.projectName}`,
        title: "Step baru perlu ditindaklanjuti",
        body: `${params.projectName} — Step ${params.stepCode}: ${stepName} (${divisionLabel})`,
        html: `
          <p>Halo,</p>
          <p>Step baru perlu ditindaklanjuti untuk project <strong>${params.projectName}</strong>.</p>
          <p><strong>Step ${params.stepCode}:</strong> ${stepName}<br/>
          <strong>PIC:</strong> ${divisionLabel}</p>
          <p><a href="${projectUrl}">Buka project →</a></p>
        `,
        url: projectUrl,
      }
    case "reminder":
      return {
        subject: `[MGK] Reminder: ${params.projectName}`,
        title: "Reminder — step belum selesai",
        body: `${params.projectName} — Step ${params.stepCode} masih menunggu (${divisionLabel})`,
        html: `
          <p>Reminder: step berikut belum diselesaikan.</p>
          <p><strong>${params.projectName}</strong><br/>
          Step ${params.stepCode}: ${stepName} (${divisionLabel})</p>
          <p><a href="${projectUrl}">Buka project →</a></p>
        `,
        url: projectUrl,
      }
    case "hogger":
      return {
        subject: `[MGK] HOGGER: ${params.projectName}`,
        title: "Step stuck — perlu perhatian",
        body: `${params.projectName} stuck di step ${params.stepCode} (${divisionLabel})`,
        html: `
          <p><strong>HOGGER alert</strong> — step stuck terlalu lama.</p>
          <p><strong>${params.projectName}</strong><br/>
          Step ${params.stepCode}: ${stepName} (${divisionLabel})</p>
          <p><a href="${projectUrl}">Buka project →</a></p>
        `,
        url: projectUrl,
      }
    case "followup": {
      const scheduleLabel =
        params.scheduledDate && params.scheduledTime
          ? formatFollowUpSchedule(params.scheduledDate, params.scheduledTime)
          : params.scheduledDate
            ? formatDateKey(params.scheduledDate)
            : "hari ini"
      const noteLine = params.followUpNote
        ? `<p><strong>Catatan:</strong> ${params.followUpNote}</p>`
        : ""
      return {
        subject: `[MGK] Follow-up: ${params.projectName}`,
        title: "Follow-up dijadwalkan — perlu ditindaklanjuti",
        body: `${params.projectName} — Step ${params.stepCode}: ${stepName} (${divisionLabel}) — ${scheduleLabel}`,
        html: `
          <p>Follow-up perlu ditindaklanjuti.</p>
          <p><strong>${params.projectName}</strong><br/>
          Step ${params.stepCode}: ${stepName} (${divisionLabel})<br/>
          <strong>Jadwal:</strong> ${scheduleLabel}</p>
          ${noteLine}
          <p><a href="${projectUrl}">Buka project →</a></p>
        `,
        url: projectUrl,
      }
    }
  }
}

export async function notifyDivisionForStep(
  params: NotifyParams
): Promise<{ emailsSent: number; pushesSent: number }> {
  const supabase = createServiceClient()
  if (!supabase) {
    console.warn("[notify] SUPABASE_SERVICE_ROLE_KEY not set — skipping notifications")
    return { emailsSent: 0, pushesSent: 0 }
  }

  const step = getStep(params.stepCode)
  if (!step) return { emailsSent: 0, pushesSent: 0 }

  const { data: stepConfig } = await supabase
    .from("reminder_config")
    .select("notify_channel")
    .eq("step_code", params.stepCode)
    .maybeSingle()

  const notifyChannel = stepConfig?.notify_channel ?? "all"
  const sendEmailChannel =
    notifyChannel === "all" || notifyChannel === "email"
  const sendPushChannel =
    notifyChannel === "all" || notifyChannel === "push"

  const divisionLabel = getDivisionLabel(step.division)
  const message = buildMessage(params, step.name, divisionLabel)
  let recipients = await getDivisionRecipients(
    supabase,
    step.division,
    params.type === "step_unlock"
  )

  // Fallback: kalau tidak ada user di division PIC, notify admin
  if (recipients.length === 0) {
    recipients = await getDivisionRecipients(supabase, "admin")
  }

  let emailsSent = 0
  const pushUserIds: string[] = []

  for (const recipient of recipients) {
    if (sendEmailChannel && recipient.notif_email) {
      const ok = await sendEmail({
        to: recipient.email,
        subject: message.subject,
        html: message.html,
      })
      if (ok) emailsSent++
    }
    if (sendPushChannel && recipient.notif_push) {
      pushUserIds.push(recipient.id)
    }
  }

  const subscriptions = await getPushSubscriptions(supabase, pushUserIds)
  const pushesSent = await sendPushToSubscriptions(subscriptions, {
    title: message.title,
    body: message.body,
    url: message.url,
  })

  const channels: string[] = []
  if (emailsSent > 0) channels.push("email")
  if (pushesSent > 0) channels.push("push")

  for (const channel of channels.length > 0 ? channels : ["skipped"]) {
    const logChannel =
      params.type === "followup" ? "followup" : channel
    await logReminder(supabase, params.projectId, params.stepCode, logChannel)
    if (params.type === "followup") break
  }

  return { emailsSent, pushesSent }
}

export async function notifyAdminsHogger(
  params: Omit<NotifyParams, "type">
): Promise<void> {
  const supabase = createServiceClient()
  if (!supabase) return

  const { data: admins } = await supabase
    .from("profiles")
    .select("id, email, notif_email, notif_push")
    .eq("status", "active")
    .or("division.eq.admin,divisions.cs.{admin}")

  const step = getStep(params.stepCode)
  if (!step || !admins?.length) return

  const message = buildMessage(
    { ...params, type: "hogger" },
    step.name,
    getDivisionLabel(step.division)
  )

  for (const admin of admins) {
    if (admin.notif_email) {
      await sendEmail({
        to: admin.email,
        subject: message.subject,
        html: message.html,
      })
    }
  }

  const pushIds = admins.filter((a) => a.notif_push).map((a) => a.id)
  const subs = await getPushSubscriptions(supabase, pushIds)
  await sendPushToSubscriptions(subs, {
    title: message.title,
    body: message.body,
    url: message.url,
  })

  await logReminder(supabase, params.projectId, params.stepCode, "hogger")
}
