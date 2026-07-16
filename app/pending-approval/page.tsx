import { redirect } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PROFILE_STATUS_LABELS, type ProfileStatus } from "@/lib/auth/profile-status"
import { createClient } from "@/lib/supabase/server"

export default async function PendingApprovalPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, status")
    .eq("id", user.id)
    .single()

  if (profile?.status === "active") {
    redirect("/")
  }

  const status = (profile?.status ?? "pending") as ProfileStatus
  const isSuspended = status === "suspended"

  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            {isSuspended ? "Akun Ditangguhkan" : "Menunggu Persetujuan"}
          </CardTitle>
          <CardDescription>
            {isSuspended
              ? "Akun Anda ditangguhkan. Hubungi admin untuk informasi lebih lanjut."
              : "Akun Anda sudah terverifikasi. Admin perlu menyetujui dan menetapkan division sebelum Anda bisa mengakses dashboard."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
            <p className="font-medium">{profile?.name ?? user.email}</p>
            <p className="text-muted-foreground">{user.email}</p>
            <p className="mt-2 text-muted-foreground">
              Status: {PROFILE_STATUS_LABELS[status]}
            </p>
          </div>
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="outline" className="w-full">
              Keluar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
