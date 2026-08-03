import { AppHeader } from "@/components/layout/app-header"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { getUiTheme } from "@/lib/ui/theme.server"
import { getMyTasks } from "@/lib/projects/tasks"
import { type Division } from "@/lib/steps"
import { createClient } from "@/lib/supabase/server"

type AppShellProps = {
  userName: string
  division?: string | null
  /** Pass when the page already fetched tasks to avoid a duplicate query. */
  outstandingCount?: number
  children: React.ReactNode
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

export async function AppShell({
  userName,
  division,
  outstandingCount: outstandingCountProp,
  children,
}: AppShellProps) {
  const theme = await getUiTheme()
  const outstandingCount =
    outstandingCountProp ?? (await fetchOutstandingCount(division))

  if (theme === "premium") {
    return (
      <div className="flex min-h-full flex-1 flex-col md:flex-row">
        <AppSidebar
          userName={userName}
          division={division}
          outstandingCount={outstandingCount}
        />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader
        userName={userName}
        division={division}
        outstandingCount={outstandingCount}
      />
      {children}
    </div>
  )
}
