export type ProfileStatus = "pending" | "active" | "suspended"

export const PROFILE_STATUS_LABELS: Record<ProfileStatus, string> = {
  pending: "Menunggu persetujuan",
  active: "Aktif",
  suspended: "Ditangguhkan",
}
