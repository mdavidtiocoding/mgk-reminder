import { notFound, redirect } from "next/navigation"

import { getAdhocCases } from "@/app/actions/adhoc-cases"
import { AdhocCasesPanel } from "@/components/project/adhoc-cases-panel"
import { ProjectPageHeader } from "@/components/project/project-page-header"
import { StageProgressBar } from "@/components/project/stage-progress-bar"
import { StepTimeline } from "@/components/project/step-timeline"
import { AppShell } from "@/components/layout/app-shell"
import { getRolePermissions, userHasPermission } from "@/lib/auth/permissions"
import { FEATURES } from "@/lib/features"
import { getProjectDetail } from "@/lib/projects/detail"
import { resolveUserDivisions } from "@/lib/auth/user-divisions"
import { getUiTheme } from "@/lib/ui/theme.server"
import { createClient } from "@/lib/supabase/server"

type ProjectDetailPageProps = {
  params: Promise<{ id: string }>
}

export default async function ProjectDetailPage({
  params,
}: ProjectDetailPageProps) {
  const { id } = await params
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
  const matrix = await getRolePermissions(supabase)
  const theme = await getUiTheme()

  const [project, adhocCases, { data: customers }] = await Promise.all([
    getProjectDetail(supabase, id, userDivisions),
    FEATURES.adhocCases ? getAdhocCases(id) : Promise.resolve([]),
    supabase.from("customers").select("id, name").order("name"),
  ])

  if (!project) {
    notFound()
  }

  const canManageAdhoc = userHasPermission(
    userDivisions,
    "manage_adhoc",
    matrix
  )
  const showAdhoc =
    FEATURES.adhocCases && (canManageAdhoc || adhocCases.length > 0)

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
            : "mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-6"
        }
      >
        <ProjectPageHeader
          variant={theme}
          projectId={project.id}
          projectName={project.name}
          customerId={project.customerId}
          customerName={project.customerName}
          createdAt={project.createdAt}
          status={project.status}
          customers={customers ?? []}
          canEditProject={userHasPermission(
            userDivisions,
            "edit_project",
            matrix
          )}
          canChangeStatus={userHasPermission(
            userDivisions,
            "change_project_status",
            matrix
          )}
          canDeleteProject={userHasPermission(
            userDivisions,
            "delete_project",
            matrix
          )}
        />

        <StageProgressBar
          currentStage={project.currentStage}
          doneCount={project.doneCount}
          totalCount={project.totalCount}
          status={project.status}
          variant={theme}
        />

        <section>
          <h3 className="mb-4 text-sm font-medium text-muted-foreground">
            Timeline
          </h3>
          <StepTimeline project={project} variant={theme} />
        </section>

        {showAdhoc && (
          <AdhocCasesPanel
            projectId={project.id}
            cases={adhocCases}
            canManage={canManageAdhoc}
          />
        )}
      </main>
    </AppShell>
  )
}
