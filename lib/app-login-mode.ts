/** Login app mode — production always uses Live. */

export const LOGIN_MODE_COOKIE = "mgk-login-mode"

export type LoginMode = "live"

export const DEFAULT_LOGIN_MODE: LoginMode = "live"

export function parseLoginMode(_value?: string | null): LoginMode {
  return "live"
}

export function loginModeLabel(_mode?: LoginMode): string {
  return "Live"
}
