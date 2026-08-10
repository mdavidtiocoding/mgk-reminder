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
    { label: "Tasks", value: myTasks },
    { label: "Hogger", value: hogger, warn: hogger > 0 },
  ]

  return (
    <div
      className="grid w-full grid-cols-3 overflow-hidden rounded-md border bg-card"
      role="group"
      aria-label="Ringkasan dashboard"
    >
      {items.map((item, index) => (
        <div
          key={item.label}
          className={cn(
            "flex min-h-9 min-w-0 items-center justify-center gap-1.5 px-1.5 py-1.5",
            index > 0 && "border-l"
          )}
        >
          <span
            className={cn(
              "text-sm font-semibold tabular-nums leading-none",
              item.warn && "text-destructive"
            )}
          >
            {item.value}
          </span>
          <span className="truncate text-[10px] leading-none text-muted-foreground">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  )
}
