import { AppHeader } from "@/components/layout/app-header"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { BottomNavigation } from "@/components/layout/bottom-navigation"
import { getRolePermissions, userHasPermission } from "@/lib/auth/permissions"
import { getUiTheme } from "@/lib/ui/theme.server"
import { getMyTasks } from "@/lib/projects/tasks"
import { type Division } from "@/lib/steps"
import { createClient } from "@/lib/supabase/server"

type AppShellProps = {
  userName: string
  /** Legacy primary division for header fallback. */
  division?: string | null
  userDivisions?: Division[]
  /** Pass when the page already fetched tasks to avoid a duplicate query. */
  outstandingCount?: number
  canCreateProject?: boolean
  children: React.ReactNode
}

async function fetchOutstandingCount(
  userDivisions: Division[] = []
): Promise<number> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return 0

  try {
    const tasks = await getMyTasks(supabase, userDivisions)
    return tasks.length
  } catch {
    return 0
  }
}

export async function AppShell({
  userName,
  division,
  userDivisions = [],
  outstandingCount: outstandingCountProp,
  canCreateProject: canCreateProjectProp,
  children,
}: AppShellProps) {
  const theme = await getUiTheme()
  const outstandingCount =
    outstandingCountProp ?? (await fetchOutstandingCount(userDivisions))

  const canCreateProject =
    canCreateProjectProp ??
    (await (async () => {
      const supabase = await createClient()
      const matrix = await getRolePermissions(supabase)
      return userHasPermission(userDivisions, "create_project", matrix)
    })())

  if (theme === "premium") {
    return (
      <div className="flex min-h-full flex-1 flex-col md:flex-row">
        <AppSidebar
          userName={userName}
          division={division}
          userDivisions={userDivisions}
          outstandingCount={outstandingCount}
          canCreateProject={canCreateProject}
        />
        <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
          {children}
        </div>
        <BottomNavigation
          outstandingCount={outstandingCount}
          canCreateProject={canCreateProject}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col pb-20 md:pb-0">
      <AppHeader
        userName={userName}
        division={division}
        userDivisions={userDivisions}
        outstandingCount={outstandingCount}
      />
      {children}
      <BottomNavigation
        outstandingCount={outstandingCount}
        canCreateProject={canCreateProject}
      />
    </div>
  )
}
