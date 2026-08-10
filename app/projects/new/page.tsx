import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { CreateProjectForm } from "@/components/project/create-project-form"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { requirePermission } from "@/lib/auth/require-permission"

export default async function CreateProjectPage() {
  const { profile, user, userDivisions, supabase } =
    await requirePermission("create_project")

  const { data: customers } = await supabase
    .from("customers")
    .select("id, name")
    .order("name")

  return (
    <AppShell
      userName={profile?.name ?? user.email ?? "User"}
      division={profile?.division}
      userDivisions={userDivisions}
      canCreateProject
    >
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 p-6">
        <Button variant="ghost" size="sm" className="w-fit" asChild>
          <Link href="/">
            <ArrowLeft className="size-4" />
            Kembali ke Dashboard
          </Link>
        </Button>
        <CreateProjectForm customers={customers ?? []} />
      </main>
    </AppShell>
  )
}
