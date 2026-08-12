/**
 * Login app mode — Demo vs Live, dipilih di halaman login.
 *
 * - live → tanpa akun @dummy.com, UI Premium only (default)
 * - demo → seperti sebelumnya: akun dummy + Classic/Premium picker
 */

export const LOGIN_MODE_COOKIE = "mgk-login-mode"

export type LoginMode = "demo" | "live"

export const DEFAULT_LOGIN_MODE: LoginMode = "live"

export function parseLoginMode(value: string | undefined | null): LoginMode {
  return value === "demo" ? "demo" : "live"
}

export function loginModeLabel(mode: LoginMode): string {
  return mode === "demo" ? "Demo" : "Live"
}
