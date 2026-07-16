import "server-only"

import webpush from "web-push"

type PushPayload = {
  title: string
  body: string
  url?: string
}

type PushSubscriptionRow = {
  endpoint: string
  p256dh: string
  auth: string
}

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY

  if (!publicKey || !privateKey) {
    return false
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:admin@mgk.local",
    publicKey,
    privateKey
  )

  return true
}

export async function sendPushToSubscriptions(
  subscriptions: PushSubscriptionRow[],
  payload: PushPayload
): Promise<number> {
  if (!configureWebPush() || subscriptions.length === 0) {
    return 0
  }

  let sent = 0
  const body = JSON.stringify(payload)

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        body
      )
      sent++
    } catch (err) {
      console.error("[push] Failed:", sub.endpoint.slice(0, 40), err)
    }
  }

  return sent
}
