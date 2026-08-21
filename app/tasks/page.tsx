import { Suspense } from "react"
import { redirect } from "next/navigation"

import { TaskCard } from "@/components/tasks/task-card"
import { AppShell } from "@/components/layout/app-shell"
import { OutstandingBadge } from "@/components/layout/outstanding-badge"
import { UrlSearchInput } from "@/components/search/url-search-input"
import { getMyTasks, type MyTask } from "@/lib/projects/tasks"
import { isUserAdmin, resolveUserDivisions } from "@/lib/auth/user-divisions"
import { createClient } from "@/lib/supabase/server"

type TaskGroup = {
  projectId: string
  projectName: string
  customerName: string | null
  maxWaitingDays: number
  tasks: MyTask[]
}

function groupTasksByProject(tasks: MyTask[]): TaskGroup[] {
  const byProject = new Map<string, TaskGroup>()

  for (const task of tasks) {
    const existing = byProject.get(task.projectId)
    if (existing) {
      existing.tasks.push(task)
      existing.maxWaitingDays = Math.max(existing.maxWaitingDays, task.waitingDays)
    } else {
      byProject.set(task.projectId, {
        projectId: task.projectId,
        projectName: task.projectName,
        customerName: task.customerName,
        maxWaitingDays: task.waitingDays,
        tasks: [task],
      })
    }
  }

  return Array.from(byProject.values()).sort(
    (a, b) => b.maxWaitingDays - a.maxWaitingDays
  )
}

export default async function MyTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, division, divisions")
    .eq("id", user.id)
    .single()

  const userDivisions = resolveUserDivisions(profile)

  let tasks: MyTask[] = []
  const { q } = await searchParams

  try {
    tasks = await getMyTasks(supabase, userDivisions, q)
  } catch {
    tasks = []
  }

  const groups = groupTasksByProject(tasks)

  return (
    <AppShell
      userName={profile?.name ?? user.email ?? "User"}
      division={profile?.division}
      userDivisions={userDivisions}
      outstandingCount={tasks.length}
    >
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-medium">My Tasks</h2>
            <OutstandingBadge count={tasks.length} className="h-6 min-w-6 px-2 text-xs" />
          </div>
          <p className="text-sm text-muted-foreground">
            {isUserAdmin(userDivisions)
              ? "Admin hanya melihat step yang sudah lewat waktu respon (default 1×24 jam). Baru trigger belum Delay."
              : "Step aktif yang menjadi tanggung jawab divisi kamu"}
            {" · "}
            <span className="font-medium text-foreground">
              {tasks.length} outstanding
            </span>
          </p>
          {isUserAdmin(userDivisions) && (
            <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Delay → <strong>Minta response</strong> ke divisi (alasan + minta
              waktu). Setelah divisi kirim, kamu <strong>approve</strong>. Kalau
              disetujui, Delay ditahan sampai tanggal itu & jadwal follow-up
              masuk calendar. Atur Follow-up tetap bisa untuk jadwal terpisah.
            </p>
          )}
          <div className="mt-3">
            <Suspense fallback={null}>
              <UrlSearchInput placeholder="Cari project, customer, step…" />
            </Suspense>
          </div>
        </div>

        {groups.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
            <p className="text-sm font-medium">
              {isUserAdmin(userDivisions)
                ? "Tidak ada project delay"
                : "Tidak ada task aktif"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isUserAdmin(userDivisions)
                ? "Semua step aktif masih on-time. My Tasks admin hanya menampilkan yang sudah telat."
                : "Semua step divisi kamu sudah selesai atau belum ada project aktif."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {groups.map((group) => (
              <section key={group.projectId} className="flex flex-col gap-3">
                <div>
                  <h3 className="text-sm font-semibold">{group.projectName}</h3>
                  <p className="text-xs text-muted-foreground">
                    {group.customerName ?? "Tanpa customer"}
                    {" · "}
                    {group.tasks.length} task
                    {group.maxWaitingDays > 0
                      ? ` · waiting max ${group.maxWaitingDays} hari`
                      : ""}
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {group.tasks.map((task) => (
                    <TaskCard
                      key={`${task.projectId}-${task.stepCode}`}
                      task={task}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </AppShell>
  )
}
