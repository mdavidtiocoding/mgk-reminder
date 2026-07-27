"use server"

import { cookies } from "next/headers"

import { UI_THEME_COOKIE, parseUiTheme, type UiTheme } from "@/lib/ui/theme"

export async function setUiTheme(theme: UiTheme): Promise<{ theme: UiTheme }> {
  const safe = parseUiTheme(theme)
  const cookieStore = await cookies()
  cookieStore.set(UI_THEME_COOKIE, safe, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  })
  return { theme: safe }
}
