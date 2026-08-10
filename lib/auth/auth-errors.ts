/** Map Supabase Auth errors to user-friendly Indonesian messages. */
export function formatAuthError(message: string): string {
  const lower = message.toLowerCase()

  if (
    lower.includes("rate limit") ||
    lower.includes("once every") ||
    lower.includes("too many requests") ||
    lower.includes("email rate limit")
  ) {
    return "Terlalu banyak permintaan email. Coba lagi nanti (±1 jam), atau hubungi admin."
  }

  if (lower.includes("same password") || lower.includes("should be different")) {
    return "Password baru harus berbeda dari password lama."
  }

  if (lower.includes("invalid email")) {
    return "Format email tidak valid."
  }

  if (lower.includes("password") && lower.includes("weak")) {
    return "Password terlalu lemah. Gunakan minimal 6 karakter."
  }

  return message
}
