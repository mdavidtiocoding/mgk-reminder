import { Resend } from "resend"

type SendEmailParams = {
  to: string
  subject: string
  html: string
}

export async function sendEmail({
  to,
  subject,
  html,
}: SendEmailParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL ?? "MGK Reminder <onboarding@resend.dev>"

  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — skipping email to", to)
    return false
  }

  // Resend sandbox: hanya bisa kirim ke email akun Resend. Override untuk dev.
  const devOverride = process.env.RESEND_DEV_TO
  const recipient = devOverride ?? to

  if (devOverride && devOverride !== to) {
    console.info(`[email] Dev override: ${to} → ${devOverride}`)
  }

  const resend = new Resend(apiKey)
  const { data, error } = await resend.emails.send({
    from,
    to: recipient,
    subject: devOverride ? `[DEV → ${to}] ${subject}` : subject,
    html,
  })

  if (error) {
    console.error("[email] Failed:", error.message, "| to:", recipient)
    return false
  }

  console.info("[email] Sent:", data?.id, "→", recipient)
  return true
}
