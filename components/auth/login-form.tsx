"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
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
import { getAppVariantBadgeLabel, showDemoLoginAccounts } from "@/lib/app-variant"
import { createClient } from "@/lib/supabase/client"

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    router.refresh()
    router.push("/")
  }

  const showDemo = showDemoLoginAccounts()
  const variantBadge = getAppVariantBadgeLabel()

  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>MGK Flow Reminder</CardTitle>
              <CardDescription>Masuk dengan email dan password perusahaan</CardDescription>
            </div>
            {variantBadge && (
              <span className="rounded-full border border-orange-300 bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-600">
                {variantBadge}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
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
              />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-primary underline-offset-4 hover:underline"
                >
                  Lupa password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Masuk..." : "Masuk"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Belum punya akun?{" "}
              <Link href="/register" className="text-primary underline-offset-4 hover:underline">
                Daftar
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>

      {showDemo && (
        <div className="rounded-lg border border-dashed p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Akun Demo</p>
          <div className="flex flex-col gap-0.5">
            {[
              ["marketing", "Marketing"],
              ["ar", "AR"],
              ["logistik", "Logistik"],
              ["finance", "Finance"],
              ["shipping", "Shipping"],
              ["project", "Project"],
              ["admin", "Admin"],
            ].map(([div, label]) => (
              <button
                key={div}
                type="button"
                className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted"
                onClick={() => {
                  setEmail(`${div}@dummy.com`)
                  setPassword(`${div}123`)
                }}
              >
                <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
                <span className="min-w-0 truncate font-mono text-muted-foreground/70">
                  {div}@dummy.com
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground/60">Klik baris untuk autofill</p>
        </div>
      )}
    </div>
  )
}
