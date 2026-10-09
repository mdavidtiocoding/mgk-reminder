import { cache } from "react"

import { OutstandingBadge } from "@/components/layout/outstanding-badge"
import { getMyTasks } from "@/lib/projects/tasks"
import type { Division } from "@/lib/steps"
import { createClient } from "@/lib/supabase/server"

/** Deduped per request — sidebar and bottom nav share one query. */
const getOutstandingCount = cache(async (divisionsKey: string): Promise<number> => {
  const divisions = (divisionsKey ? divisionsKey.split(",") : []) as Division[]
  try {
    const supabase = await createClient()
    const tasks = await getMyTasks(supabase, divisions)
    return tasks.length
  } catch {
    return 0
  }
})

export async function AsyncOutstandingBadge({
  userDivisions,
  className,
}: {
  userDivisions: Division[]
  className?: string
}) {
  const count = await getOutstandingCount([...userDivisions].sort().join(","))
  return <OutstandingBadge count={count} className={className} />
}
