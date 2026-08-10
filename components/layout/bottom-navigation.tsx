"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  ListTodo,
  PlusCircle,
  Search,
  Settings,
} from "lucide-react"

import { OutstandingBadge } from "@/components/layout/outstanding-badge"
import { cn } from "@/lib/utils"

type BottomNavigationProps = {
  outstandingCount?: number
}

const TABS = [
  { href: "/", label: "Home", icon: LayoutDashboard, exact: true },
  { href: "/tasks", label: "Tasks", icon: ListTodo, exact: false },
  { href: "/?focus=search", label: "Cari", icon: Search, exact: false, search: true },
  { href: "/projects/new", label: "Baru", icon: PlusCircle, exact: false },
  { href: "/settings", label: "Settings", icon: Settings, exact: false },
] as const

export function BottomNavigation({ outstandingCount = 0 }: BottomNavigationProps) {
  const pathname = usePathname()

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden"
      style={{ paddingBottom: "max(0.25rem, env(safe-area-inset-bottom))" }}
      aria-label="Navigasi utama"
    >
      <div className="flex items-stretch justify-around">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isSearch = "search" in tab && tab.search
          const active = isSearch
            ? false
            : tab.exact
              ? pathname === tab.href
              : pathname === tab.href || pathname.startsWith(`${tab.href}/`)

          return (
            <Link
              key={tab.label}
              href={tab.href}
              className={cn(
                "relative flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="relative">
                <Icon className="size-5" aria-hidden />
                {tab.href === "/tasks" && outstandingCount > 0 && (
                  <span className="absolute -right-2.5 -top-1.5">
                    <OutstandingBadge count={outstandingCount} />
                  </span>
                )}
              </span>
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
