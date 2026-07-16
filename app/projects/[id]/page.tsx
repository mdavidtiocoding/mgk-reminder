import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { getAdhocCases } from "@/app/actions/adhoc-cases"
import { AdhocCasesPanel } from "@/components/project/adhoc-cases-panel"
import { ProjectHeaderActions } from "@/components/project/project-header-actions"
import { StageProgressBar } from "@/components/project/stage-progress-bar"
import { StepTimeline } from "@/components/project/step-timeline"
import { AppHeader } from "@/components/layout/app-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/format"
import { getProjectDetail } from "@/lib/projects/detail"
import type { Division } from "@/lib/steps"
import { createClient } from "@/lib/supabase/server"

type ProjectDetailPageProps = {
  params: Promise<{ id: string }>
}

const STATUS_LABELS = {
  active: "Aktif",
  completed: "Selesai",
  on_hold: "Ditahan",
} as const

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
    .select("name, division")
    .eq("id", user.id)
    .single()

  const userDivision = profile?.division as Division | undefined
  const isAdmin = userDivision === "admin"

  const [project, adhocCases, { data: customers }] = await Promise.all([
    getProjectDetail(supabase, id, userDivision),
    getAdhocCases(id),
    supabase.from("customers").select("id, name").order("name"),
  ])

  if (!project) {
    notFound()
  }

  const showAdhoc =
    userDivision === "admin" || userDivision === "project" || adhocCases.length > 0
  const canManageAdhoc =
    userDivision === "admin" || userDivision === "project"

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader
        userName={profile?.name ?? user.email ?? "User"}
        division={profile?.division}
      />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-6">
        <Button variant="ghost" size="sm" className="w-fit" asChild>
          <Link href="/">
            <ArrowLeft className="size-4" />
            Kembali ke Dashboard
          </Link>
        </Button>

        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold">{project.name}</h2>
              <Badge
                variant={project.status === "on_hold" ? "outline" : "secondary"}
              >
                {STATUS_LABELS[project.status]}
              </Badge>
            </div>
            <ProjectHeaderActions
              projectId={project.id}
              projectName={project.name}
              customerId={project.customerId}
              status={project.status}
              customers={customers ?? []}
              isAdmin={isAdmin}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Customer: {project.customerName ?? "—"}
          </p>
          <p className="text-sm text-muted-foreground">
            Mulai: {formatDate(project.createdAt)}
          </p>
        </header>

        <StageProgressBar
          currentStage={project.currentStage}
          doneCount={project.doneCount}
          totalCount={project.totalCount}
          status={project.status}
        />

        <section>
          <h3 className="mb-4 text-sm font-medium text-muted-foreground">
            Timeline
          </h3>
          <StepTimeline project={project} />
        </section>

        {showAdhoc && (
          <AdhocCasesPanel
            projectId={project.id}
            cases={adhocCases}
            canManage={canManageAdhoc}
          />
        )}
      </main>
    </div>
  )
}
