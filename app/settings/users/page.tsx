import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { listUsers } from "@/app/actions/users"
import { CreateUserForm } from "@/components/settings/create-user-form"
import { UsersTable } from "@/components/settings/users-table"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requirePermission } from "@/lib/auth/require-permission"
import { resolveUserDivisions } from "@/lib/auth/user-divisions"
import type { Division } from "@/lib/steps"

export default async function UserManagementPage() {
  const { profile, user, userDivisions } = await requirePermission("settings_users")
  const users = await listUsers()

  return (
    <AppShell
      userName={profile?.name ?? user.email ?? "User"}
      division={profile?.division}
      userDivisions={userDivisions}
    >
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-6">
        <Button variant="ghost" size="sm" className="w-fit" asChild>
          <Link href="/settings">
            <ArrowLeft className="size-4" />
            Kembali ke Settings
          </Link>
        </Button>

        <div>
          <h2 className="text-base font-medium">User Management</h2>
          <p className="text-sm text-muted-foreground">
            Admin only — kelola user, assign divisi (bisa lebih dari satu), dan setujui pendaftar baru.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tambah User</CardTitle>
            <CardDescription>
              User bisa langsung login dengan email dan password awal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateUserForm />
          </CardContent>
        </Card>

        <Card className="overflow-visible">
          <CardHeader>
            <CardTitle>Daftar User</CardTitle>
            <CardDescription>
              {users.length} user{users.length !== 1 ? "s" : ""} terdaftar
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-visible">
            <UsersTable
              users={users.map((u) => ({
                ...u,
                division: (u.division as Division | null) ?? null,
                divisions: (u.divisions as Division[] | null) ?? null,
                status: u.status as "pending" | "active" | "suspended",
              }))}
              currentUserId={user.id}
            />
          </CardContent>
        </Card>
      </main>
    </AppShell>
  )
}
