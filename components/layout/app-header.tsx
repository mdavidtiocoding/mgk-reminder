import Link from "next/link"

import { Button } from "@/components/ui/button"
import { getMyTasks } from "@/lib/projects/tasks"
import { type Division } from "@/lib/steps"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

type AppHeaderProps = {
  userName: string
  division?: string | null
  /** Pass when the page already fetched tasks to avoid a duplicate query. */
  outstandingCount?: number
}

async function fetchOutstandingCount(
  division: string | null | undefined
): Promise<number> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return 0

  try {
    const tasks = await getMyTasks(supabase, division as Division | undefined)
    return tasks.length
  } catch {
    return 0
  }
}

function OutstandingBadge({
  count,
  className,
}: {
  count: number
  className?: string
}) {
  if (count <= 0) return null

  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-white tabular-nums",
        className
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  )
}

export async function AppHeader({
  userName,
  division,
  outstandingCount: outstandingCountProp,
}: AppHeaderProps) {
  const outstandingCount =
    outstandingCountProp ??
    (await fetchOutstandingCount(division))

  return (
    <header className="flex items-center justify-between gap-4 border-b px-6 py-4">
      <div>
        <h1 className="text-lg font-semibold">MGK Flow Reminder</h1>
        <p className="text-sm text-muted-foreground">
          {userName}
          {division ? ` · ${division}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">Dashboard</Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/tasks" className="inline-flex items-center gap-2">
            My Tasks
            <OutstandingBadge count={outstandingCount} />
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

export { OutstandingBadge }
