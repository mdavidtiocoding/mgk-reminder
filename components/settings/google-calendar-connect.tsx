"use client"

import Link from "next/link"
import { useTransition } from "react"

import { disconnectGoogleCalendar } from "@/app/actions/google-calendar"
import { Button } from "@/components/ui/button"

const STATUS_MESSAGES: Record<string, string> = {
  connected: "Google Calendar berhasil terhubung.",
  denied: "Koneksi Google Calendar dibatalkan.",
  error: "Gagal menghubungkan Google Calendar. Coba lagi.",
  invalid_state: "Sesi OAuth tidak valid. Coba hubungkan lagi.",
  missing_config: "Google OAuth belum dikonfigurasi di server.",
}

type GoogleCalendarConnectProps = {
  connected: boolean
  status?: string | null
  errorDetail?: string | null
  redirectUriHint?: string
}

export function GoogleCalendarConnect({
  connected,
  status,
  errorDetail,
  redirectUriHint,
}: GoogleCalendarConnectProps) {
  const [isPending, startTransition] = useTransition()

  function handleDisconnect() {
    startTransition(async () => {
      await disconnectGoogleCalendar()
    })
  }

  const statusMessage = status ? STATUS_MESSAGES[status] : null

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">Google Calendar</p>
        <p className="text-sm text-muted-foreground">
          {connected
            ? "Terhubung — reminder step & follow-up akan dibuat di kalender Anda."
            : "Hubungkan akun Google untuk otomatis buat event reminder di kalender."}
        </p>
      </div>

      {statusMessage && (
        <p
          className={`text-sm ${status === "connected" ? "text-foreground" : "text-destructive"}`}
          role="status"
        >
          {statusMessage}
          {status === "error" && errorDetail ? (
            <span className="mt-1 block text-xs">{errorDetail}</span>
          ) : null}
        </p>
      )}

      {!connected && redirectUriHint && status !== "error" && (
        <p className="rounded-md border bg-background px-3 py-2 font-mono text-xs text-muted-foreground break-all">
          Daftarkan URI ini di Google Cloud Console → Credentials → Authorized redirect
          URIs:
          <br />
          <span className="text-foreground">{redirectUriHint}</span>
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {connected ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={handleDisconnect}
          >
            {isPending ? "Memutuskan..." : "Putuskan Google Calendar"}
          </Button>
        ) : (
          <Button size="sm" asChild>
            <Link href="/api/auth/google">Connect Google Calendar</Link>
          </Button>
        )}
      </div>
    </div>
  )
}
