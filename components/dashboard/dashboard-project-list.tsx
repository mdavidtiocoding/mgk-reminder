"use client"

import { useDeferredValue, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Search } from "lucide-react"

import { ProjectCard } from "@/components/dashboard/project-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { DashboardProject } from "@/lib/projects/dashboard"

type DashboardProjectListProps = {
  projects: DashboardProject[]
}

export function DashboardProjectList({ projects }: DashboardProjectListProps) {
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

      {filtered.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <p className="text-sm font-medium">
            {projects.length === 0 ? "Belum ada project" : "Tidak ada hasil"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {projects.length === 0
              ? "Buat project pertama untuk mulai tracking workflow."
              : "Coba kata kunci lain atau ubah filter."}
          </p>
          {projects.length === 0 && (
            <Button className="mt-4" size="sm" asChild>
              <Link href="/projects/new">+ Buat Project</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}
