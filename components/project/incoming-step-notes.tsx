import { MessageSquare } from "lucide-react"

import type { IncomingStepNote } from "@/lib/steps/note-route-config"
import { cn } from "@/lib/utils"

export function IncomingStepNotes({
  notes,
  compact = false,
}: {
  notes: IncomingStepNote[]
  compact?: boolean
}) {
  if (notes.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {notes.map((note) => (
        <div
          key={`${note.fromStep}-${note.message}`}
          className={cn(
            "rounded-md border border-sky-200 bg-sky-50/70 px-3 py-2",
            compact && "px-2.5 py-1.5"
          )}
        >
          <p
            className={cn(
              "mb-1 flex items-center gap-1.5 font-medium text-sky-950",
              compact ? "text-[11px]" : "text-xs"
            )}
          >
            <MessageSquare className={cn("shrink-0", compact ? "size-3" : "size-3.5")} />
            Catatan dari {note.fromStep}
            {note.fromName !== note.fromStep ? ` — ${note.fromName}` : ""}
          </p>
          <p
            className={cn(
              "whitespace-pre-wrap text-sky-950",
              compact ? "text-xs" : "text-sm"
            )}
          >
            {note.message}
          </p>
        </div>
      ))}
    </div>
  )
}
