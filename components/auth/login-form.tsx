"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"

import { setUiTheme } from "@/app/actions/ui-theme"
import { ThemePicker } from "@/components/auth/theme-picker"
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
import {
  DEFAULT_LOGIN_MODE,
  LOGIN_MODE_COOKIE,
  parseLoginMode,
  type LoginMode,
} from "@/lib/app-login-mode"
import { createClient } from "@/lib/supabase/client"
import type { UiTheme } from "@/lib/ui/theme"
import { cn } from "@/lib/utils"

const DEMO_ACCOUNTS = [
  ["marketing", "Marketing"],
  ["ar", "AR"],
  ["logistik", "Logistik"],
  ["finance", "Finance"],
  ["shipping", "Shipping"],
  ["project", "Project"],
  ["admin", "Admin"],
] as const

function readLoginModeCookie(): LoginMode {
  if (typeof document === "undefined") return DEFAULT_LOGIN_MODE
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${LOGIN_MODE_COOKIE}=`))
  return parseLoginMode(match?.split("=")[1])
}

function writeLoginModeCookie(mode: LoginMode) {
  const maxAge = 60 * 60 * 24 * 365
  document.cookie = `${LOGIN_MODE_COOKIE}=${mode}; path=/; max-age=${maxAge}; samesite=lax`
}

function applyThemeClass(theme: UiTheme) {
  document.documentElement.classList.remove("theme-classic", "theme-premium")
  document.documentElement.classList.add(
    theme === "premium" ? "theme-premium" : "theme-classic"
  )
  document.documentElement.dataset.uiTheme = theme
}

type LoginFormProps = {
  initialTheme: UiTheme
}

export function LoginForm({ initialTheme }: LoginFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<LoginMode>(DEFAULT_LOGIN_MODE)
  const [modeReady, setModeReady] = useState(false)

  useEffect(() => {
    setMode(readLoginModeCookie())
    setModeReady(true)
  }, [])

  function selectMode(next: LoginMode) {
    if (next === mode || isPending) return
    setMode(next)
    writeLoginModeCookie(next)

    if (next === "live") {
      setEmail("")
      setPassword("")
      setError(null)
      applyThemeClass("premium")
      startTransition(async () => {
        await setUiTheme("premium")
        router.refresh()
      })
      return
    }

    startTransition(() => {
      router.refresh()
    })
  }

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

  const showDemo = modeReady && mode === "demo"

  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <div className="grid grid-cols-2 gap-1 rounded-lg border bg-muted/40 p-1">
        {(
          [
            {
              value: "live" as const,
              label: "Live",
              hint: "Akun perusahaan",
            },
            {
              value: "demo" as const,
              label: "Demo",
              hint: "Akun dummy",
            },
          ] as const
        ).map((option) => {
          const active = modeReady && mode === option.value
          return (
            <button
              key={option.value}
              type="button"
              disabled={isPending}
              onClick={() => selectMode(option.value)}
              className={cn(
                "rounded-md px-3 py-2 text-left transition-colors",
                active
                  ? "bg-background shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="block text-sm font-medium">{option.label}</span>
              <span className="block text-[11px] leading-tight opacity-70">
                {option.hint}
              </span>
            </button>
          )
        })}
      </div>

      <Card className="w-full">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle>MGK Flow Reminder</CardTitle>
              <CardDescription>
                {mode === "demo"
                  ? "Mode demo — pakai akun dummy di bawah, atau masuk manual"
                  : "Masuk dengan email dan password perusahaan"}
              </CardDescription>
            </div>
            {modeReady && (
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium",
                  mode === "demo"
                    ? "border-amber-300 bg-amber-50 text-amber-700"
                    : "border-emerald-300 bg-emerald-50 text-emerald-700"
                )}
              >
                {mode === "demo" ? "Demo" : "Live"}
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
                placeholder={
                  mode === "demo" ? "admin@dummy.com" : "nama@perusahaan.com"
                }
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
            {mode === "live" && (
              <p className="text-center text-sm text-muted-foreground">
                Belum punya akun?{" "}
                <Link
                  href="/register"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Daftar
                </Link>
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      {showDemo && (
        <>
          <div className="rounded-lg border border-dashed border-amber-300/70 bg-amber-50/40 p-3">
            <p className="mb-2 text-xs font-medium text-amber-900/80">
              Akun Demo — klik untuk autofill
            </p>
            <div className="flex flex-col gap-0.5">
              {DEMO_ACCOUNTS.map(([div, label]) => (
                <button
                  key={div}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-xs hover:bg-amber-100/70"
                  onClick={() => {
                    setEmail(`${div}@dummy.com`)
                    setPassword(`${div}123`)
                  }}
                >
                  <span className="w-24 shrink-0 text-muted-foreground">
                    {label}
                  </span>
                  <span className="min-w-0 truncate font-mono text-muted-foreground/70">
                    {div}@dummy.com
                  </span>
                </button>
              ))}
            </div>
          </div>

          <ThemePicker initialTheme={initialTheme} />
        </>
      )}
    </div>
  )
}
