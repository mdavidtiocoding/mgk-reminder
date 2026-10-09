import { OutstandingBadge } from "@/components/layout/outstanding-badge"
import { getMyTasks } from "@/lib/projects/tasks"
import type { Division } from "@/lib/steps"
import { createClient } from "@/lib/supabase/server"

async function getOutstandingCount(userDivisions: Division[]): Promise<number> {
  try {
    const supabase = await createClient()
    const tasks = await getMyTasks(supabase, userDivisions)
    return tasks.length
  } catch {
    return 0
  }
}

export async function AsyncOutstandingBadge({
  userDivisions,
  className,
}: {
  userDivisions: Division[]
  className?: string
}) {
  const count = await getOutstandingCount(userDivisions)
  return <OutstandingBadge count={count} className={className} />
}
