import { Suspense } from "react"
import { redirect } from "next/navigation"

import { DashboardFilters } from "@/components/dashboard/dashboard-filters"
import { DashboardProjectList } from "@/components/dashboard/dashboard-project-list"
import { DashboardStatsBar } from "@/components/dashboard/dashboard-stats-bar"
import { PushOnboardingBanner } from "@/components/notifications/push-onboarding-banner"
import { AppShell } from "@/components/layout/app-shell"
import { getDashboardProjects, type DashboardProject } from "@/lib/projects/dashboard"
import { resolveUserDivisions } from "@/lib/auth/user-divisions"
import { getUiTheme } from "@/lib/ui/theme.server"
import { createClient } from "@/lib/supabase/server"

type DashboardPageProps = {
  searchParams: Promise<{
    status?: string
    stage?: string
    division?: string
    sort?: string
    q?: string
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
    .select("name, division, divisions")
    .eq("id", user.id)
    .single()

  const userDivisions = resolveUserDivisions(profile)

  const filters = await searchParams
  const theme = await getUiTheme()
  let projects: DashboardProject[] = []
  let loadError: string | null = null

  try {
    projects = await getDashboardProjects(supabase, filters)
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : "Gagal memuat daftar project."
    console.error("getDashboardProjects:", error)
  }

  return (
    <AppShell
      userName={profile?.name ?? user.email ?? "User"}
      division={profile?.division}
      userDivisions={userDivisions}
    >
      <main
        className={
          theme === "premium"
            ? "mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6"
            : "flex flex-1 flex-col gap-6 p-6"
        }
      >
        <PushOnboardingBanner />

        {theme === "premium" && (
          <DashboardStatsBar
            projects={projects}
            userDivisions={userDivisions}
          />
        )}

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

        <DashboardProjectList
          projects={projects}
          loadError={loadError}
          variant={theme}
        />
      </main>
    </AppShell>
  )
}
