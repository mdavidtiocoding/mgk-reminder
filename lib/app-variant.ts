/**
 * App variant — satu codebase, dua "versi" lewat env Vercel.
 *
 * - beta    → akun demo di login, badge Beta
 * - release → tanpa akun demo (production)
 *
 * Vercel Production (release): NEXT_PUBLIC_APP_VARIANT=release
 * Vercel Preview / project beta: NEXT_PUBLIC_APP_VARIANT=beta
 */

export type AppVariant = "beta" | "release"

export function getAppVariant(): AppVariant {
  const value = process.env.NEXT_PUBLIC_APP_VARIANT?.trim().toLowerCase()
  return value === "beta" ? "beta" : "release"
}

export function isBetaApp(): boolean {
  return getAppVariant() === "beta"
}

export function showDemoLoginAccounts(): boolean {
  // Sementara: demo tetap di production selama akun @dummy.com masih dipakai.
  // Matikan nanti dengan return isBetaApp() atau env NEXT_PUBLIC_SHOW_DEMO_LOGIN=false.
  return true
}

export function getAppVariantBadgeLabel(): string | null {
  return isBetaApp() ? "Beta 1.0" : null
}
