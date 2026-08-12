import { cookies } from "next/headers"

import {
  DEFAULT_LOGIN_MODE,
  LOGIN_MODE_COOKIE,
  parseLoginMode,
  type LoginMode,
} from "@/lib/app-login-mode"

export async function getLoginMode(): Promise<LoginMode> {
  const cookieStore = await cookies()
  return parseLoginMode(
    cookieStore.get(LOGIN_MODE_COOKIE)?.value ?? DEFAULT_LOGIN_MODE
  )
}

export async function isDemoLoginMode(): Promise<boolean> {
  return (await getLoginMode()) === "demo"
}
