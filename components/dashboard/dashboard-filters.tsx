"use client"

import { Suspense, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Plus, X } from "lucide-react"

import { UrlSearchInput } from "@/components/search/url-search-input"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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

type Chip = { key: string; label: string; clearValue: string }

export function DashboardFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [sheetOpen, setSheetOpen] = useState(false)

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

  const chips = useMemo(() => {
    const list: Chip[] = []
    const status = searchParams.get("status")
    if (status && status !== "active") {
      const label =
        STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status
      list.push({
        key: "status",
        label: `Status: ${label}`,
        clearValue: "active",
      })
    }
    const stage = searchParams.get("stage")
    if (stage) {
      list.push({
        key: "stage",
        label: `Tahap: ${STAGE_LABELS[Number(stage)] ?? stage}`,
        clearValue: "all",
      })
    }
    const division = searchParams.get("division")
    if (division) {
      list.push({
        key: "division",
        label: DIVISION_LABELS[division as Division] ?? division,
        clearValue: "all",
      })
    }
    const sort = searchParams.get("sort")
    if (sort && sort !== "newest") {
      const label = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? sort
      list.push({
        key: "sort",
        label: `Urut: ${label}`,
        clearValue: "newest",
      })
    }
    return list
  }, [searchParams])

  const selects = (
    <>
      <FilterField label="Status">
        <Select
          value={searchParams.get("status") ?? "active"}
          onValueChange={(value) => updateParam("status", value)}
        >
          <SelectTrigger className="w-full min-w-[8.5rem]" size="sm">
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
      </FilterField>

      <FilterField label="Tahap">
        <Select
          value={searchParams.get("stage") ?? "all"}
          onValueChange={(value) => updateParam("stage", value)}
        >
          <SelectTrigger className="w-full min-w-[8.5rem]" size="sm">
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
      </FilterField>

      <FilterField label="Divisi">
        <Select
          value={searchParams.get("division") ?? "all"}
          onValueChange={(value) => updateParam("division", value)}
        >
          <SelectTrigger className="w-full min-w-[8.5rem]" size="sm">
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
      </FilterField>

      <FilterField label="Urutkan">
        <Select
          value={searchParams.get("sort") ?? "newest"}
          onValueChange={(value) => updateParam("sort", value)}
        >
          <SelectTrigger className="w-full min-w-[8.5rem]" size="sm">
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
      </FilterField>
    </>
  )

  return (
    <div className="flex w-full flex-col gap-3">
      <Suspense fallback={null}>
        <UrlSearchInput
          id="dashboard-search"
          placeholder="Cari project, customer, step…"
        />
      </Suspense>

      <div className="flex flex-wrap items-center gap-2">
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => updateParam(chip.key, chip.clearValue)}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-md border bg-muted/60 px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            {chip.label}
            <X className="size-3.5 text-muted-foreground" aria-hidden />
            <span className="sr-only">Hapus filter {chip.label}</span>
          </button>
        ))}

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1 rounded-md px-3 text-xs md:hidden"
          onClick={() => setSheetOpen(true)}
        >
          <Plus className="size-3.5" />
          Filter
        </Button>
      </div>

      <div className="hidden flex-wrap items-end gap-3 md:flex">{selects}</div>

      <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Filter project</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">{selects}</div>
          <Button className="mt-2 w-full" onClick={() => setSheetOpen(false)}>
            Terapkan
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FilterField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-[10rem] flex-1 flex-col gap-1">
      <span className="text-[11px] font-medium text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  )
}
