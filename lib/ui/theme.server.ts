import { cookies } from "next/headers"

import { getLoginMode } from "@/lib/app-login-mode.server"
import {
  DEFAULT_UI_THEME,
  parseUiTheme,
  UI_THEME_COOKIE,
  type UiTheme,
} from "@/lib/ui/theme"

/**
 * Live mode → selalu Premium (Classic di-hide).
 * Demo mode → ikut cookie seperti sebelumnya (default Classic).
 */
export async function getUiTheme(): Promise<UiTheme> {
  const mode = await getLoginMode()
  if (mode === "live") return "premium"

  const cookieStore = await cookies()
  return parseUiTheme(
    cookieStore.get(UI_THEME_COOKIE)?.value ?? DEFAULT_UI_THEME
  )
}
