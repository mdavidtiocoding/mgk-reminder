import Link from "next/link"
import { ArrowLeft, ScrollText } from "lucide-react"

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
import { formatDateTime } from "@/lib/format"

type AuditRow = {
  id: string
  created_at: string
  actor_name: string | null
  action: string
  summary: string
  project_id: string | null
}

const ACTION_SHORT: Record<string, string> = {
  "project.create": "Buat",
  "project.update": "Edit",
  "project.status": "Status",
  "project.delete": "Hapus",
  "step.complete": "Done",
  "step.undo": "Undo",
  "substep.complete": "Sub✓",
  "substep.undo": "Sub↩",
  "adhoc.create": "Adhoc+",
  "adhoc.resolve": "Adhoc✓",
  "user.create": "User+",
  "user.update_divisions": "Divisi",
  "user.update_status": "User≠",
  "user.delete": "User−",
  "permissions.update": "Akses",
  "flow.update": "Flow",
}

export default async function AuditLogPage() {
  const { profile, user, userDivisions, supabase } =
    await requirePermission("settings_audit")

  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, created_at, actor_name, action, summary, project_id")
    .order("created_at", { ascending: false })
    .limit(150)

  const rows = (data ?? []) as AuditRow[]

  return (
    <AppShell
      userName={profile?.name ?? user.email ?? "User"}
      division={profile?.division}
      userDivisions={userDivisions}
    >
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4 sm:gap-6 sm:p-6">
        <Button variant="ghost" size="sm" className="w-fit" asChild>
          <Link href="/settings">
            <ArrowLeft className="size-4" />
            Settings
          </Link>
        </Button>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ScrollText className="size-4" />
              Audit log
            </CardTitle>
            <CardDescription>
              Riwayat aksi penting (buat / edit / undo / hapus). Hanya admin.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {error ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                Gagal memuat. Jalankan{" "}
                <code className="text-xs">database/add-audit-logs.sql</code> di
                Supabase.
              </p>
            ) : rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Belum ada aktivitas tercatat.
              </p>
            ) : (
              <ul className="divide-y rounded-md border">
                {rows.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-start gap-2 px-2.5 py-2 text-xs sm:gap-3 sm:px-3"
                  >
                    <span className="w-[4.5rem] shrink-0 tabular-nums text-muted-foreground sm:w-[7.5rem]">
                      {formatDateTime(row.created_at)}
                    </span>
                    <span className="w-12 shrink-0 rounded bg-muted px-1 py-0.5 text-center text-[10px] font-semibold tracking-wide text-muted-foreground">
                      {ACTION_SHORT[row.action] ?? row.action.split(".").pop()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">
                        {row.actor_name ?? "—"}
                      </p>
                      <p className="truncate text-muted-foreground">
                        {row.summary}
                        {row.project_id ? (
                          <>
                            {" · "}
                            <Link
                              href={`/projects/${row.project_id}`}
                              className="text-primary hover:underline"
                            >
                              buka
                            </Link>
                          </>
                        ) : null}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
    </AppShell>
  )
}
