import type { DashboardProject } from "@/lib/projects/dashboard"
import type { Division } from "@/lib/steps"

type DashboardStatsBarProps = {
  projects: DashboardProject[]
  userDivision?: string | null
}

function countMyTaskProjects(
  projects: DashboardProject[],
  userDivision?: string | null
): number {
  if (!userDivision) return 0
  return projects.filter((project) =>
    project.activeSteps.some(
      (step) => userDivision === "admin" || step.division === userDivision
    )
  ).length
}

export function DashboardStatsBar({
  projects,
  userDivision,
}: DashboardStatsBarProps) {
  const total = projects.length
  const myTasks = countMyTaskProjects(projects, userDivision as Division | undefined)
  const hogger = projects.filter((project) => project.isHogger).length

  const items = [
    { label: "Total Project", value: total },
    { label: "My Tasks", value: myTasks },
    { label: "Hogger", value: hogger, warn: hogger > 0 },
  ]

  return (
    <div className="grid auto-rows-fr gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex min-h-[5.5rem] flex-col justify-center rounded-xl border bg-card px-4 py-3 transition-colors duration-150"
        >
          <p
            className={
              item.warn
                ? "text-2xl font-bold tabular-nums text-destructive"
                : "text-2xl font-bold tabular-nums"
            }
          >
            {item.value}
          </p>
          <p className="text-sm text-muted-foreground">{item.label}</p>
        </div>
      ))}
    </div>
  )
}
