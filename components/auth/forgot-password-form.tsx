"use client"

import Link from "next/link"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatAuthError } from "@/lib/auth/auth-errors"
import { createClient } from "@/lib/supabase/client"

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const trimmed = email.trim().toLowerCase()
    if (!trimmed) {
      setError("Email wajib diisi.")
      setLoading(false)
      return
    }

    const supabase = createClient()
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      trimmed,
      { redirectTo }
    )

    if (resetError) {
      setError(formatAuthError(resetError.message))
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Lupa password</CardTitle>
        <CardDescription>
          Masukkan email akun. Kami kirim link untuk set password baru.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <div className="flex flex-col gap-3 text-sm">
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900">
              Jika email <span className="font-medium">{email.trim()}</span>{" "}
              terdaftar, link reset sudah dikirim. Cek inbox / spam.
            </p>
            <p className="text-muted-foreground">
              Link berlaku terbatas. Setelah dibuka, Anda bisa langsung buat
              password baru — tanpa approval admin.
            </p>
            <Button variant="outline" asChild>
              <Link href="/login">Kembali ke login</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="nama@perusahaan.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Mengirim…" : "Kirim link reset"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              <Link
                href="/login"
                className="text-primary underline-offset-4 hover:underline"
              >
                Kembali ke login
              </Link>
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
