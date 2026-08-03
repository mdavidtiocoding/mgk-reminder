"use client"

import { useDeferredValue, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Search } from "lucide-react"

import { ProjectCard, PREMIUM_PROJECT_CARD_HEIGHT } from "@/components/dashboard/project-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { DashboardProject } from "@/lib/projects/dashboard"
import type { UiTheme } from "@/lib/ui/theme"

type DashboardProjectListProps = {
  projects: DashboardProject[]
  loadError?: string | null
  variant?: UiTheme
}

export function DashboardProjectList({
  projects,
  loadError,
  variant = "classic",
}: DashboardProjectListProps) {
  const [query, setQuery] = useState("")
  const [debounced, setDebounced] = useState("")

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim().toLowerCase()), 300)
    return () => clearTimeout(t)
  }, [query])

  const deferred = useDeferredValue(debounced)

  const filtered = useMemo(() => {
    if (!deferred) return projects
    return projects.filter((p) => {
      const name = p.name.toLowerCase()
      const customer = (p.customerName ?? "").toLowerCase()
      return name.includes(deferred) || customer.includes(deferred)
    })
  }, [projects, deferred])

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Cari project atau customer..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8"
        />
      </div>

      {loadError && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Gagal memuat project: {loadError}. Cek koneksi Supabase atau jalankan{" "}
          <code className="text-xs">database/add-substeps.sql</code> jika belum.
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <p className="text-sm font-medium">
            {loadError
              ? "Project tidak bisa dimuat"
              : projects.length === 0
                ? "Belum ada project"
                : "Tidak ada hasil"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {loadError
              ? "Lihat pesan error di atas."
              : projects.length === 0
                ? "Buat project baru, atau ubah filter status ke Semua status jika project sudah selesai."
                : "Coba kata kunci lain atau ubah filter."}
          </p>
          {projects.length === 0 && !loadError && (
            <Button className="mt-4" size="sm" asChild>
              <Link href="/projects/new">+ Buat Project</Link>
            </Button>
          )}
        </div>
      ) : (
        <div
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          style={
            variant === "premium"
              ? { gridAutoRows: PREMIUM_PROJECT_CARD_HEIGHT }
              : undefined
          }
        >
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} variant={variant} />
          ))}
        </div>
      )}
    </div>
  )
}
