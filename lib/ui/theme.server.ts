import { cookies } from "next/headers"

import {
  DEFAULT_UI_THEME,
  parseUiTheme,
  UI_THEME_COOKIE,
  type UiTheme,
} from "@/lib/ui/theme"

export async function getUiTheme(): Promise<UiTheme> {
  const cookieStore = await cookies()
  return parseUiTheme(cookieStore.get(UI_THEME_COOKIE)?.value ?? DEFAULT_UI_THEME)
}
