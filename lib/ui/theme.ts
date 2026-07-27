export const UI_THEME_COOKIE = "mgk-ui-theme"

export type UiTheme = "classic" | "premium"

export const DEFAULT_UI_THEME: UiTheme = "classic"

export function parseUiTheme(value: string | undefined | null): UiTheme {
  return value === "premium" ? "premium" : "classic"
}

export function uiThemeLabel(theme: UiTheme): string {
  return theme === "premium" ? "Premium (Preview)" : "Classic"
}
