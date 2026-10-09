import { redirect } from "next/navigation"

import { AppShell } from "@/components/layout/app-shell"
import { getSessionProfile, getSessionUser } from "@/lib/auth/session"
import { resolveUserDivisions } from "@/lib/auth/user-divisions"

/** Sidebar / nav stay mounted across navigations; only the page segment re-renders. */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()
  if (!user) redirect("/login")

  const profile = await getSessionProfile(user.id)

  return (
    <AppShell
      userName={profile?.name ?? user.email ?? "User"}
      division={profile?.division}
      userDivisions={resolveUserDivisions(profile)}
    >
      {children}
    </AppShell>
  )
}
