/** Map Supabase Auth errors to user-friendly Indonesian messages. */
export function formatAuthError(message: string): string {
  const lower = message.toLowerCase()

  if (
    lower.includes("rate limit") ||
    lower.includes("once every") ||
    lower.includes("too many requests")
  ) {
    return "Terlalu banyak permintaan email verifikasi dari sistem. Coba lagi dalam ±1 jam, atau hubungi admin agar akun dibuatkan langsung."
  }

  if (lower.includes("invalid email")) {
    return "Format email tidak valid."
  }

  if (lower.includes("password") && lower.includes("weak")) {
    return "Password terlalu lemah. Gunakan minimal 6 karakter."
  }

  return message
}
