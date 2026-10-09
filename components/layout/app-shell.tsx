import { Suspense } from "react"

import { AppHeader } from "@/components/layout/app-header"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { AsyncOutstandingBadge } from "@/components/layout/async-outstanding-badge"
import { BottomNavigation } from "@/components/layout/bottom-navigation"
import { getRolePermissions, userHasPermission } from "@/lib/auth/permissions"
import { getUiTheme } from "@/lib/ui/theme.server"
import { type Division } from "@/lib/steps"
import { createClient } from "@/lib/supabase/server"

type AppShellProps = {
  userName: string
  /** Legacy primary division for header fallback. */
  division?: string | null
  userDivisions?: Division[]
  canCreateProject?: boolean
  children: React.ReactNode
}

function tasksBadge(userDivisions: Division[]): React.ReactNode {
  return (
    <Suspense fallback={null}>
      <AsyncOutstandingBadge userDivisions={userDivisions} />
    </Suspense>
  )
}

export async function AppShell({
  userName,
  division,
  userDivisions = [],
  canCreateProject: canCreateProjectProp,
  children,
}: AppShellProps) {
  const badge = tasksBadge(userDivisions)

  const [theme, canCreateProject] = await Promise.all([
    getUiTheme(),
    canCreateProjectProp ??
      createClient()
        .then(getRolePermissions)
        .then((matrix) =>
          userHasPermission(userDivisions, "create_project", matrix)
        ),
  ])

  if (theme === "premium") {
    return (
      <div className="flex min-h-full flex-1 flex-col md:flex-row">
        <AppSidebar
          userName={userName}
          division={division}
          userDivisions={userDivisions}
          tasksBadge={badge}
          canCreateProject={canCreateProject}
        />
        <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
          {children}
        </div>
        <BottomNavigation tasksBadge={badge} canCreateProject={canCreateProject} />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col pb-20 md:pb-0">
      <AppHeader
        userName={userName}
        division={division}
        userDivisions={userDivisions}
        tasksBadge={badge}
      />
      {children}
      <BottomNavigation tasksBadge={badge} canCreateProject={canCreateProject} />
    </div>
  )
}
