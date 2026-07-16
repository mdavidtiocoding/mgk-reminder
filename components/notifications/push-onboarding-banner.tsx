"use client"

import { useEffect, useState } from "react"
import { Bell, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { getVapidPublicKey } from "@/lib/notifications/vapid"

const STORAGE_KEY = "mgk-push-banner-dismissed"

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

export function PushOnboardingBanner() {
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (localStorage.getItem(STORAGE_KEY) === "1") return
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return
    if (!getVapidPublicKey()) return
    if (Notification.permission === "granted") return
    if (Notification.permission === "denied") return
    setVisible(true)
  }, [])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1")
    setVisible(false)
  }

  async function enable() {
    setLoading(true)
    try {
      const vapidKey = getVapidPublicKey()
      if (!vapidKey) {
        dismiss()
        return
      }

      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        dismiss()
        return
      }

      const registration = await navigator.serviceWorker.register("/sw.js")
      await navigator.serviceWorker.ready

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })

      const json = subscription.toJSON()
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
        }),
      })

      dismiss()
    } catch {
      dismiss()
    } finally {
      setLoading(false)
    }
  }

  if (!visible) return null

  return (
    <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
      <Bell className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          Aktifkan notifikasi browser agar tidak melewatkan reminder.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" onClick={enable} disabled={loading}>
            {loading ? "Mengaktifkan..." : "Aktifkan"}
          </Button>
          <Button size="sm" variant="ghost" onClick={dismiss} disabled={loading}>
            Nanti saja
          </Button>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Tutup"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
