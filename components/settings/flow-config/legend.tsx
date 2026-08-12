"use client"

import { ChevronDown } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { DIVISION_BADGE_STYLES, DIVISION_LABELS, type Division } from "@/lib/steps"
import { COMPLETION_MODE_BADGES, COMPLETION_MODE_LABELS } from "@/lib/steps/completion-mode"
import { cn } from "@/lib/utils"

const LEGEND_ITEMS = [
  { icon: "☑️", label: "Checklist", desc: "Centang Pakai checklist, lalu pilih mode" },
  { icon: "☑️", label: "Checklist + Keterangan", desc: "Tidak dicentang = wajib isi keterangan" },
  { icon: "🔁", label: "Step reschedule", desc: "Selesai / Belum + pilih tanggal berikutnya" },
  { icon: "🧩", label: "Sub-step", desc: "Bisa punya checklist sendiri (tick + mode)" },
  { icon: "🔗", label: "Prasyarat", desc: "Step yang harus selesai dulu" },
  { icon: "⚡", label: "Memicu", desc: "Step yang aktif setelah ini selesai" },
  { icon: "📅", label: "Notif & kalender", desc: "Langsung saat step unlock" },
  { icon: "🔁", label: "Repeat", desc: "Tiap N hari — Settings → Reminder" },
  { icon: "✏️", label: "Klik baris", desc: "Buka panel edit semua pengaturan" },
] as const

export function FlowConfigLegend({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(!compact)

  return (
    <div className="rounded-lg border bg-muted/20">
      <Button
        type="button"
        variant="ghost"
        className="flex h-auto w-full items-center justify-between px-3 py-2"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-sm font-medium">Legenda & panduan singkat</span>
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </Button>
      {open && (
        <div className="grid gap-3 border-t px-3 py-3 sm:grid-cols-2 lg:grid-cols-3">
          {LEGEND_ITEMS.map((item) => (
            <div key={item.label} className="flex gap-2 text-xs">
              <span className="shrink-0 text-base leading-none">{item.icon}</span>
              <div>
                <p className="font-medium">{item.label}</p>
                <p className="text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
          <div className="sm:col-span-2 lg:col-span-3">
            <p className="mb-2 text-xs font-medium">Badge divisi (PIC step)</p>
            <div className="flex flex-wrap gap-1.5">
              {(Object.entries(DIVISION_LABELS) as [Division, string][])
                .filter(([d]) => d !== "admin")
                .map(([division, label]) => (
                  <span
                    key={division}
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      DIVISION_BADGE_STYLES[division].badge
                    )}
                  >
                    {label}
                  </span>
                ))}
            </div>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <p className="mb-2 text-xs font-medium">Mode selesai</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(COMPLETION_MODE_LABELS).map(([mode, label]) => (
                <span
                  key={mode}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    COMPLETION_MODE_BADGES[mode as keyof typeof COMPLETION_MODE_BADGES]
                  )}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
