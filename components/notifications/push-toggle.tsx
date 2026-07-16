"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { getVapidPublicKey } from "@/lib/notifications/vapid"

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

export function PushNotificationToggle() {
  const [supported, setSupported] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setSupported(
      "serviceWorker" in navigator &&
        "PushManager" in window &&
        !!getVapidPublicKey()
    )
  }, [])

  async function subscribe() {
    setLoading(true)
    setMessage(null)

    try {
      const vapidKey = getVapidPublicKey()
      if (!vapidKey) {
        setMessage("VAPID key belum dikonfigurasi.")
        return
      }

      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setMessage("Izin notifikasi ditolak.")
        return
      }

      const registration = await navigator.serviceWorker.register("/sw.js")
      await navigator.serviceWorker.ready

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })

      const json = subscription.toJSON()
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setMessage(data.error ?? "Gagal menyimpan subscription.")
        return
      }

      setSubscribed(true)
      setMessage("Push notification aktif untuk browser ini.")
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Gagal subscribe push.")
    } finally {
      setLoading(false)
    }
  }

  if (!supported) {
    return (
      <p className="text-sm text-muted-foreground">
        Push notification belum dikonfigurasi (butuh VAPID keys + HTTPS/localhost).
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        size="sm"
        variant={subscribed ? "secondary" : "default"}
        onClick={subscribe}
        disabled={loading || subscribed}
      >
        {loading
          ? "Mengaktifkan..."
          : subscribed
            ? "Push aktif ✓"
            : "Aktifkan push notification"}
      </Button>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  )
}
