"use client"

import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { UrlSearchInput } from "@/components/search/url-search-input"
import { DIVISION_LABELS, STAGE_LABELS, type Division } from "@/lib/steps"

const STATUS_OPTIONS = [
  { value: "active", label: "Aktif" },
  { value: "completed", label: "Selesai" },
  { value: "on_hold", label: "On Hold" },
  { value: "all", label: "Semua status" },
] as const

const SORT_OPTIONS = [
  { value: "newest", label: "Terbaru" },
  { value: "stuck", label: "Paling lama nunggu" },
  { value: "stage", label: "Tahap" },
] as const

export function DashboardFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === "all" && (key === "stage" || key === "division")) {
      params.delete(key)
    } else if (value === "newest" && key === "sort") {
      params.delete(key)
    } else if (value === "active" && key === "status") {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    const query = params.toString()
    router.push(query ? `/?${query}` : "/")
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Suspense fallback={null}>
        <UrlSearchInput placeholder="Cari project, customer, step…" />
      </Suspense>

      <Select
        value={searchParams.get("status") ?? "active"}
        onValueChange={(value) => updateParam("status", value)}
      >
        <SelectTrigger className="w-[160px]" size="sm">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("stage") ?? "all"}
        onValueChange={(value) => updateParam("stage", value)}
      >
        <SelectTrigger className="w-[200px]" size="sm">
          <SelectValue placeholder="Tahap" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Semua tahap</SelectItem>
          {Object.entries(STAGE_LABELS).map(([stage, label]) => (
            <SelectItem key={stage} value={stage}>
              Tahap {stage}: {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("division") ?? "all"}
        onValueChange={(value) => updateParam("division", value)}
      >
        <SelectTrigger className="w-[180px]" size="sm">
          <SelectValue placeholder="Division" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Semua divisi</SelectItem>
          {(Object.entries(DIVISION_LABELS) as [Division, string][])
            .filter(([division]) => division !== "admin")
            .map(([division, label]) => (
              <SelectItem key={division} value={division}>
                {label}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("sort") ?? "newest"}
        onValueChange={(value) => updateParam("sort", value)}
      >
        <SelectTrigger className="w-[200px]" size="sm">
          <SelectValue placeholder="Urutkan" />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
