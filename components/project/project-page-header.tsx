import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { ProjectHeaderActions } from "@/components/project/project-header-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/format"
import type { ProjectStatus } from "@/lib/steps"
import { cn } from "@/lib/utils"

type CustomerOption = { id: string; name: string }

type ProjectPageHeaderProps = {
  variant: "classic" | "premium"
  projectId: string
  projectName: string
  customerId: string | null
  customerName: string | null
  createdAt: string
  status: ProjectStatus
  customers: CustomerOption[]
  canEditProject?: boolean
  canChangeStatus?: boolean
  canDeleteProject?: boolean
}

const STATUS_LABELS = {
  active: "Aktif",
  completed: "Selesai",
  on_hold: "Ditahan",
} as const

export function ProjectPageHeader({
  variant,
  projectId,
  projectName,
  customerId,
  customerName,
  createdAt,
  status,
  customers,
  canEditProject = false,
  canChangeStatus = false,
  canDeleteProject = false,
}: ProjectPageHeaderProps) {
  const actions = (
    <ProjectHeaderActions
      projectId={projectId}
      projectName={projectName}
      customerId={customerId}
      status={status}
      customers={customers}
      canEditProject={canEditProject}
      canChangeStatus={canChangeStatus}
      canDeleteProject={canDeleteProject}
    />
  )

  if (variant === "classic") {
    return (
      <>
        <Button variant="ghost" size="sm" className="w-fit" asChild>
          <Link href="/">
            <ArrowLeft className="size-4" />
            Kembali ke Dashboard
          </Link>
        </Button>

        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold">{projectName}</h2>
              <Badge variant={status === "on_hold" ? "outline" : "secondary"}>
                {STATUS_LABELS[status]}
              </Badge>
            </div>
            {actions}
          </div>
          <p className="text-sm text-muted-foreground">
            Customer: {customerName ?? "—"}
          </p>
          <p className="text-sm text-muted-foreground">
            Mulai: {formatDate(createdAt)}
          </p>
        </header>
      </>
    )
  }

  return (
    <div className="-mx-6 -mt-6 border-b border-slate-200/80 bg-gradient-to-b from-slate-50 via-white to-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 py-6">
        <Button variant="ghost" size="sm" className="w-fit text-muted-foreground" asChild>
          <Link href="/">
            <ArrowLeft className="size-4" />
            Kembali
          </Link>
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                {projectName}
              </h2>
              <Badge
                className={cn(
                  status === "on_hold" &&
                    "border-amber-200 bg-amber-50 text-amber-800",
                  status === "completed" &&
                    "border-slate-200 bg-slate-100 text-slate-700",
                  status === "active" &&
                    "border-emerald-200 bg-emerald-50 text-emerald-700"
                )}
              >
                {STATUS_LABELS[status]}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Customer: {customerName ?? "—"} · Mulai {formatDate(createdAt)}
            </p>
          </div>
          {actions}
        </div>
      </div>
    </div>
  )
}
