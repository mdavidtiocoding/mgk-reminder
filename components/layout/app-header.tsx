import Link from "next/link"

import { Button } from "@/components/ui/button"

type AppHeaderProps = {
  userName: string
  division?: string | null
}

export function AppHeader({ userName, division }: AppHeaderProps) {
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
          <Link href="/tasks">My Tasks</Link>
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
