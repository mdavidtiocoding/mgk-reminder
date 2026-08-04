import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { CreateProjectForm } from "@/components/project/create-project-form"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { resolveUserDivisions } from "@/lib/auth/user-divisions"
import { createClient } from "@/lib/supabase/server"

export default async function CreateProjectPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, division, divisions")
    .eq("id", user.id)
    .single()

  const userDivisions = resolveUserDivisions(profile)

  const { data: customers } = await supabase
    .from("customers")
    .select("id, name")
    .order("name")

  return (
    <AppShell
      userName={profile?.name ?? user.email ?? "User"}
      division={profile?.division}
      userDivisions={userDivisions}
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
