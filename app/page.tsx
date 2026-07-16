import { Suspense } from "react"
import { redirect } from "next/navigation"

import { DashboardFilters } from "@/components/dashboard/dashboard-filters"
import { DashboardProjectList } from "@/components/dashboard/dashboard-project-list"
import { PushOnboardingBanner } from "@/components/notifications/push-onboarding-banner"
import { AppHeader } from "@/components/layout/app-header"
import { getDashboardProjects, type DashboardProject } from "@/lib/projects/dashboard"
import { createClient } from "@/lib/supabase/server"

type DashboardPageProps = {
  searchParams: Promise<{
    status?: string
    stage?: string
    division?: string
    sort?: string
  }>
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, division")
    .eq("id", user.id)
    .single()

  const filters = await searchParams
  let projects: DashboardProject[] = []

  try {
    projects = await getDashboardProjects(supabase, filters)
  } catch {
    projects = []
  }

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader
        userName={profile?.name ?? user.email ?? "User"}
        division={profile?.division}
      />
      <main className="flex flex-1 flex-col gap-6 p-6">
        <PushOnboardingBanner />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-medium">Projects</h2>
            <p className="text-sm text-muted-foreground">
              {projects.length} project{projects.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Suspense fallback={null}>
            <DashboardFilters />
          </Suspense>
        </div>

        <DashboardProjectList projects={projects} />
      </main>
    </div>
  )
}
