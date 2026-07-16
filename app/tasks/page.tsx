import { redirect } from "next/navigation"

import { TaskCard } from "@/components/tasks/task-card"
import { AppHeader } from "@/components/layout/app-header"
import { getMyTasks, type MyTask } from "@/lib/projects/tasks"
import type { Division } from "@/lib/steps"
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

export default async function MyTasksPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, division")
    .eq("id", user.id)
    .single()

  let tasks: MyTask[] = []

  try {
    tasks = await getMyTasks(
      supabase,
      profile?.division as Division | undefined
    )
  } catch {
    tasks = []
  }

  const groups = groupTasksByProject(tasks)

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader
        userName={profile?.name ?? user.email ?? "User"}
        division={profile?.division}
      />
      <main className="flex flex-1 flex-col gap-6 p-6">
        <div>
          <h2 className="text-base font-medium">My Tasks</h2>
          <p className="text-sm text-muted-foreground">
            Step aktif yang menjadi tanggung jawab divisi kamu
            {profile?.division === "admin" ? " (admin: semua step)" : ""}
            {" · "}
            {tasks.length} task{tasks.length !== 1 ? "s" : ""}
          </p>
        </div>

        {groups.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
            <p className="text-sm font-medium">Tidak ada task aktif</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Semua step divisi kamu sudah selesai atau belum ada project aktif.
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
    </div>
  )
}
