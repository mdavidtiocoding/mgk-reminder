import {
  AlertCircle,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Mail,
  Package,
  PauseCircle,
  Ship,
  Wrench,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  DIVISION_BADGE_STYLES,
  getDivisionLabel,
  type Division,
  type ProjectStatus,
} from "@/lib/steps"
import { cn } from "@/lib/utils"

const DIVISION_ICONS: Record<Division, LucideIcon> = {
  marketing: Mail,
  finance: CircleDollarSign,
  ar: ClipboardList,
  shipping: Ship,
  logistik: Package,
  project: Wrench,
  admin: ClipboardList,
}

type ProjectStatusBadgeProps = {
  status: ProjectStatus
  isHogger?: boolean
  delayDays?: number
  isWaitingWarning?: boolean
  className?: string
}

/** Max 1 status signal: delay/hogger, or project status if not active. */
export function ProjectStatusBadge({
  status,
  isHogger,
  delayDays = 0,
  isWaitingWarning,
  className,
}: ProjectStatusBadgeProps) {
  if (status === "on_hold") {
    return (
      <Badge variant="outline" className={cn("gap-1 font-medium", className)}>
        <PauseCircle className="size-3" aria-hidden />
        Ditahan
      </Badge>
    )
  }

  if (status === "completed") {
    return (
      <Badge
        className={cn(
          "gap-1 border-emerald-200 bg-emerald-50 font-medium text-emerald-800",
          className
        )}
      >
        <CheckCircle2 className="size-3" aria-hidden />
        Selesai
      </Badge>
    )
  }

  if (isHogger || (delayDays > 0 && isWaitingWarning)) {
    return (
      <Badge variant="destructive" className={cn("gap-1 font-medium", className)}>
        <AlertCircle className="size-3" aria-hidden />
        {delayDays > 0 ? `Delay ${delayDays}h` : "HOGGER"}
      </Badge>
    )
  }

  if (delayDays > 0) {
    return (
      <Badge
        className={cn(
          "gap-1 border-amber-200 bg-amber-50 font-medium text-amber-900",
          className
        )}
      >
        <AlertCircle className="size-3" aria-hidden />
        Delay {delayDays}h
      </Badge>
    )
  }

  return (
    <Badge
      className={cn(
        "gap-1 border-emerald-200 bg-emerald-50 font-medium text-emerald-800",
        className
      )}
    >
      <CheckCircle2 className="size-3" aria-hidden />
      On track
    </Badge>
  )
}

type DivisionBadgeProps = {
  division: Division
  label?: string
  className?: string
}

export function DivisionBadge({ division, label, className }: DivisionBadgeProps) {
  const Icon = DIVISION_ICONS[division]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium",
        DIVISION_BADGE_STYLES[division].badge,
        className
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      {label ?? getDivisionLabel(division)}
    </span>
  )
}
