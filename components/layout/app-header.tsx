import Link from "next/link"

import { OutstandingBadge } from "@/components/layout/outstanding-badge"
import { Button } from "@/components/ui/button"
import { getDivisionLabel, type Division } from "@/lib/steps"

type AppHeaderProps = {
  userName: string
  division?: string | null
  userDivisions?: Division[]
  /** Pass when the page already fetched tasks to avoid a duplicate query. */
  outstandingCount?: number
}

export async function AppHeader({
  userName,
  division,
  userDivisions = [],
  outstandingCount,
}: AppHeaderProps) {
  const divisionKeys =
    userDivisions.length > 0
      ? userDivisions
      : division
        ? [division as Division]
        : []
  const divisionLabel =
    divisionKeys.length > 0
      ? divisionKeys.map((d) => getDivisionLabel(d)).join(", ")
      : null

  return (
    <header className="flex items-center justify-between gap-4 border-b px-6 py-4">
      <div>
        <h1 className="text-lg font-semibold">MGK Flow Reminder</h1>
        <p className="text-sm text-muted-foreground">
          {userName}
          {divisionLabel ? ` · ${divisionLabel}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">Dashboard</Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/tasks" className="inline-flex items-center gap-2">
            My Tasks
            <OutstandingBadge count={outstandingCount ?? 0} />
          </Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/settings">Settings</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/projects/new">+ Project</Link>
        </Button>
        <form action="/auth/signout" method="post">
          <Button type="submit" variant="outline" size="sm">
            Keluar
          </Button>
        </form>
      </div>
    </header>
  )
}

export { OutstandingBadge } from "@/components/layout/outstanding-badge"
