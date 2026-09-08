import type { LoginMode } from "@/lib/app-login-mode"

export async function getLoginMode(): Promise<LoginMode> {
  return "live"
}

export async function isDemoLoginMode(): Promise<boolean> {
  return false
}
