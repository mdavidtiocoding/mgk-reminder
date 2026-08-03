"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import {
  LayoutDashboard,
  ListTodo,
  Menu,
  Plus,
  Settings,
  X,
} from "lucide-react"

import { OutstandingBadge } from "@/components/layout/outstanding-badge"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { getAppVariantBadgeLabel } from "@/lib/app-variant"
import {
  DIVISION_BADGE_STYLES,
  getDivisionLabel,
  type Division,
} from "@/lib/steps"
import { cn } from "@/lib/utils"

type AppSidebarProps = {
  userName: string
  division?: string | null
  outstandingCount: number
}

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/tasks", label: "My Tasks", icon: ListTodo, exact: false },
  { href: "/settings", label: "Settings", icon: Settings, exact: false },
] as const

function NavLinks({
  pathname,
  outstandingCount,
  onNavigate,
  mobile = false,
}: {
  pathname: string
  outstandingCount: number
  onNavigate?: () => void
  mobile?: boolean
}) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`)
        const Icon = item.icon

        return (
          <Button
            key={item.href}
            variant="ghost"
            size="sm"
            className={cn(
              "h-9 w-full justify-start gap-2 px-3 font-normal transition-colors duration-150",
              mobile && "h-11",
              active
                ? "bg-primary/10 font-medium text-primary hover:bg-primary/15 hover:text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            asChild
          >
            <Link href={item.href} onClick={onNavigate}>
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="flex-1 text-left">{item.label}</span>
              {item.href === "/tasks" && (
                <OutstandingBadge count={outstandingCount} />
              )}
            </Link>
          </Button>
        )
      })}
    </nav>
  )
}

function SidebarPanel({
  userName,
  divisionKey,
  divisionStyle,
  variantBadge,
  pathname,
  outstandingCount,
  onNavigate,
  mobile = false,
}: {
  userName: string
  divisionKey: Division | undefined
  divisionStyle: string
  variantBadge: string | null
  pathname: string
  outstandingCount: number
  onNavigate?: () => void
  mobile?: boolean
}) {
  return (
    <>
      <div
        className={cn(
          "flex items-center gap-2.5 px-3 py-4",
          mobile && "pt-[max(1rem,env(safe-area-inset-top))]"
        )}
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
          M
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight">MGK</p>
          <p className="truncate text-xs text-muted-foreground">
            Flow Reminder
            {variantBadge ? (
              <span className="ml-1 text-orange-600">· {variantBadge}</span>
            ) : null}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-2">
        <NavLinks
          pathname={pathname}
          outstandingCount={outstandingCount}
          onNavigate={onNavigate}
          mobile={mobile}
        />
        <Button
          variant="outline"
          size="sm"
          className={cn("mx-1 gap-1.5", mobile && "h-11")}
          asChild
        >
          <Link href="/projects/new" onClick={onNavigate}>
            <Plus className="size-4" />
            Project Baru
          </Link>
        </Button>
      </div>

      <div
        className={cn(
          "mt-auto border-t px-3 py-4",
          mobile && "pb-[max(1rem,env(safe-area-inset-bottom))]"
        )}
      >
        <div className="flex flex-col gap-2">
          {divisionKey && (
            <span
              className={cn(
                "w-fit rounded-full px-2 py-0.5 text-[11px] font-medium",
                divisionStyle
              )}
            >
              {getDivisionLabel(divisionKey)}
            </span>
          )}
          <p className="truncate text-sm font-medium">{userName}</p>
          <form action="/auth/signout" method="post">
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className={cn("w-full", mobile && "h-11")}
            >
              Keluar
            </Button>
          </form>
        </div>
      </div>
    </>
  )
}

export function AppSidebar({
  userName,
  division,
  outstandingCount,
}: AppSidebarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const divisionKey = division as Division | undefined
  const divisionStyle =
    divisionKey && DIVISION_BADGE_STYLES[divisionKey]
      ? DIVISION_BADGE_STYLES[divisionKey].badge
      : "bg-muted text-muted-foreground"
  const variantBadge = getAppVariantBadgeLabel()

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const panelProps = {
    userName,
    divisionKey,
    divisionStyle,
    variantBadge,
    pathname,
    outstandingCount,
  }

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-30 flex items-center justify-between gap-3 border-b bg-background px-4 py-3 md:hidden",
          "pt-[max(0.75rem,env(safe-area-inset-top))]"
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            M
          </div>
          <span className="truncate text-sm font-semibold">MGK Flow Reminder</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10 shrink-0"
          aria-label={mobileOpen ? "Tutup menu" : "Buka menu navigasi"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </header>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-[min(280px,85vw)] max-w-[85vw] gap-0 border-r bg-sidebar p-0 shadow-xl"
          aria-describedby={undefined}
        >
          <div className="flex h-full flex-col">
            <SidebarPanel
              {...panelProps}
              mobile
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      <aside className="hidden w-[220px] shrink-0 flex-col border-r bg-sidebar md:flex">
        <SidebarPanel {...panelProps} />
      </aside>
    </>
  )
}
