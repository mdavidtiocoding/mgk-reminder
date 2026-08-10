import type { DashboardProject } from "@/lib/projects/dashboard"
import { userHasDivision } from "@/lib/auth/user-divisions"
import type { Division } from "@/lib/steps"
import { cn } from "@/lib/utils"

type DashboardStatsBarProps = {
  projects: DashboardProject[]
  userDivisions?: Division[]
}

function countMyTaskProjects(
  projects: DashboardProject[],
  userDivisions: Division[] = []
): number {
  if (userDivisions.length === 0) return 0
  return projects.filter((project) =>
    project.activeSteps.some((step) =>
      userHasDivision(userDivisions, step.division)
    )
  ).length
}

export function DashboardStatsBar({
  projects,
  userDivisions = [],
}: DashboardStatsBarProps) {
  const total = projects.length
  const myTasks = countMyTaskProjects(projects, userDivisions)
  const hogger = projects.filter((project) => project.isHogger).length

  const items = [
    { label: "Project", value: total },
    { label: "My Tasks", value: myTasks },
    { label: "Hogger", value: hogger, warn: hogger > 0 },
  ]

  return (
    <div className="flex items-stretch divide-x overflow-hidden rounded-lg border bg-card">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-2 py-2.5 sm:py-3"
        >
          <p
            className={cn(
              "text-lg font-semibold tabular-nums leading-none sm:text-xl",
              item.warn && "text-destructive"
            )}
          >
            {item.value}
          </p>
          <p className="truncate text-[11px] text-muted-foreground sm:text-xs">
            {item.label}
          </p>
        </div>
      ))}
    </div>
  )
}
