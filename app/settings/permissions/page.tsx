import Link from "next/link"

import { RolePermissionsMatrixForm } from "@/components/settings/role-permissions-matrix"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getRolePermissions } from "@/lib/auth/permissions"
import { isUserSuperAdmin } from "@/lib/auth/user-divisions"
import { requirePermission } from "@/lib/auth/require-permission"

export default async function RolePermissionsPage() {
  const { profile, user, userDivisions, supabase } =
    await requirePermission("settings_permissions")

  const matrix = await getRolePermissions(supabase)
  const canEdit = isUserSuperAdmin(userDivisions)

  return (
    <AppShell
      userName={profile?.name ?? user.email ?? "User"}
      division={profile?.division}
      userDivisions={userDivisions}
    >
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-medium">Akses per role</h2>
            <p className="text-sm text-muted-foreground">
              {canEdit
                ? "Super Admin — ubah fitur yang boleh dipakai tiap role."
                : "Admin — lihat matriks akses (read-only)."}
            </p>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link href="/settings">← Settings</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Matriks akses</CardTitle>
            <CardDescription>
              Centang = boleh.{" "}
              {canEdit
                ? "Perubahan langsung dipakai di UI dan server action (setelah simpan)."
                : "Mode lihat saja — tidak bisa disimpan."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RolePermissionsMatrixForm
              initialMatrix={matrix}
              canEdit={canEdit}
            />
          </CardContent>
        </Card>
      </main>
    </AppShell>
  )
}
