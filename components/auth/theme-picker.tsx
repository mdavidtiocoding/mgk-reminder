"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { LayoutGrid, Sparkles } from "lucide-react"

import { setUiTheme } from "@/app/actions/ui-theme"
import { cn } from "@/lib/utils"
import { parseUiTheme, type UiTheme } from "@/lib/ui/theme"

type ThemePickerProps = {
  initialTheme: UiTheme
}

const OPTIONS: {
  value: UiTheme
  label: string
  description: string
  icon: typeof LayoutGrid
}[] = [
  {
    value: "classic",
    label: "Classic",
    description: "Tampilan saat ini — header atas, card abu-abu",
    icon: LayoutGrid,
  },
  {
    value: "premium",
    label: "Premium",
    description: "Preview redesign — sidebar, stat bar, accent divisi",
    icon: Sparkles,
  },
]

function applyThemeClass(theme: UiTheme) {
  document.documentElement.classList.remove("theme-classic", "theme-premium")
  document.documentElement.classList.add(
    theme === "premium" ? "theme-premium" : "theme-classic"
  )
  document.documentElement.dataset.uiTheme = theme
}

export function ThemePicker({ initialTheme }: ThemePickerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const theme = parseUiTheme(initialTheme)

  function select(next: UiTheme) {
    if (next === theme || isPending) return
    applyThemeClass(next)
    startTransition(async () => {
      await setUiTheme(next)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">Tampilan UI</p>
      <div className="grid grid-cols-2 gap-2">
        {OPTIONS.map((option) => {
          const Icon = option.icon
          const active = theme === option.value
          return (
            <button
              key={option.value}
              type="button"
              disabled={isPending}
              onClick={() => select(option.value)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-all duration-150",
                active
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-border hover:border-primary/30 hover:bg-muted/50"
              )}
            >
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Icon className="size-3.5 shrink-0" aria-hidden />
                {option.label}
                {option.value === "premium" && (
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                    Preview
                  </span>
                )}
              </span>
              <span className="text-[11px] leading-snug text-muted-foreground">
                {option.description}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
