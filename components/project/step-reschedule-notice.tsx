import { formatDateKey } from "@/lib/format"
import { cn } from "@/lib/utils"

export function StepRescheduleNotice({
  rescheduleDate,
  className,
}: {
  rescheduleDate: string
  rescheduledAt?: string
  className?: string
}) {
  return (
    <p
      className={cn(
        "rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-sm text-amber-900",
        className
      )}
    >
      Exwork reschedule: {formatDateKey(rescheduleDate)}
    </p>
  )
}
