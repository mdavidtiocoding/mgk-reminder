import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requirePermission } from "@/lib/auth/require-permission"
import {
  DIVISION_BADGE_STYLES,
  DIVISION_LABELS,
  type Division,
} from "@/lib/steps"
import { cn } from "@/lib/utils"

const DEMO_DIVISIONS: Division[] = [
  "marketing",
  "ar",
  "logistik",
  "finance",
  "shipping",
  "project",
]

export default async function DemoPreviewIndexPage() {
  const { profile, user, userDivisions } = await requirePermission("settings_demo")

  return (
    <AppShell
      userName={profile?.name ?? user.email ?? "User"}
      division={profile?.division}
      userDivisions={userDivisions}
    >
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
        <Button variant="ghost" size="sm" className="w-fit" asChild>
          <Link href="/settings">
            <ArrowLeft className="size-4" />
            Kembali ke Settings
          </Link>
        </Button>

        <div>
          <h2 className="text-base font-medium">Demo Task Preview</h2>
          <p className="text-sm text-muted-foreground">
            Pilih divisi — tampilkan semua step mereka seperti kartu My Tasks,
            lalu edit checklist / sub-step langsung.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {DEMO_DIVISIONS.map((division) => (
            <Link key={division} href={`/settings/demo/${division}`}>
              <Card
                className={cn(
                  "h-full border-l-4 transition-colors hover:bg-muted/40",
                  DIVISION_BADGE_STYLES[division].border
                )}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {DIVISION_LABELS[division]}
                  </CardTitle>
                  <CardDescription>
                    Preview task + edit konfigurasi
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium",
                      DIVISION_BADGE_STYLES[division].badge
                    )}
                  >
                    Demo {DIVISION_LABELS[division]}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </AppShell>
  )
}
