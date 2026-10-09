"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DivisionBadge } from "@/components/ui/status-badges"
import { formatDateKey } from "@/lib/format"
import { formatDelayDuration } from "@/lib/projects/delay"
import type {
  DelaySummaryRow,
  DelaySummaryStatus,
} from "@/lib/projects/delay-summary"
import { DIVISION_BADGE_STYLES, getDivisionLabel, type Division } from "@/lib/steps"
import { cn } from "@/lib/utils"

type SortKey = "delay" | "project" | "division" | "step"
type SortDir = "asc" | "desc"

const STATUS_LABELS: Record<DelaySummaryStatus, string> = {
  delay: "Delay",
  awaiting_division: "Menunggu divisi",
  awaiting_approval: "Menunggu approve",
  extended: "Extend",
}

const STATUS_STYLES: Record<DelaySummaryStatus, string> = {
  delay: "bg-red-100 text-red-700",
  awaiting_division: "bg-amber-100 text-amber-800",
  awaiting_approval: "bg-sky-100 text-sky-800",
  extended: "bg-emerald-100 text-emerald-800",
}

const SORT_OPTIONS: { value: `${SortKey}:${SortDir}`; label: string }[] = [
  { value: "delay:desc", label: "Delay terlama" },
  { value: "delay:asc", label: "Delay terbaru" },
  { value: "project:asc", label: "Project A–Z" },
  { value: "division:asc", label: "Divisi A–Z" },
  { value: "step:asc", label: "Kode step" },
]

function compareRows(a: DelaySummaryRow, b: DelaySummaryRow, key: SortKey): number {
  switch (key) {
    case "delay":
      return a.overdueHours - b.overdueHours || a.waitingHours - b.waitingHours
    case "project":
      return a.projectName.localeCompare(b.projectName, "id")
    case "division":
      return a.divisionLabel.localeCompare(b.divisionLabel, "id")
    case "step":
      return a.stepCode.localeCompare(b.stepCode, "id", { numeric: true })
  }
}

function stepHref(row: DelaySummaryRow): string {
  return `/projects/${row.projectId}?step=${encodeURIComponent(row.stepCode)}#step-${row.stepCode}`
}

function statusDetail(row: DelaySummaryRow): string | null {
  if (row.status === "extended" && row.approvedUntil) {
    return `s/d ${formatDateKey(row.approvedUntil)}`
  }
  if (row.status === "awaiting_approval" && row.requestedUntil) {
    return `minta s/d ${formatDateKey(row.requestedUntil)}`
  }
  return null
}

export function DelaySummaryView({ rows }: { rows: DelaySummaryRow[] }) {
  const [query, setQuery] = useState("")
  const [division, setDivision] = useState<"all" | Division>("all")
  const [status, setStatus] = useState<"all" | DelaySummaryStatus>("all")
  const [sortKey, setSortKey] = useState<SortKey>("delay")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const divisionCounts = useMemo(() => {
    const counts = new Map<Division, number>()
    for (const row of rows) {
      if (row.status === "extended") continue
      counts.set(row.division, (counts.get(row.division) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [rows])

  const activeDelayCount = rows.filter((r) => r.status !== "extended").length
  const delayedProjectCount = new Set(
    rows.filter((r) => r.status !== "extended").map((r) => r.projectId)
  ).size

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const result = rows.filter((row) => {
      if (division !== "all" && row.division !== division) return false
      if (status !== "all" && row.status !== status) return false
      if (!q) return true
      return [row.projectName, row.customerName, row.stepCode, row.stepName, row.divisionLabel]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(q))
    })
    result.sort((a, b) => {
      const diff = compareRows(a, b, sortKey)
      return sortDir === "asc" ? diff : -diff
    })
    return result
  }, [rows, query, division, status, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir(key === "delay" ? "desc" : "asc")
    }
  }

  function renderSortHeader(label: string, k: SortKey) {
    const Icon = sortKey !== k ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown
    return (
      <th className="px-3 py-2 text-left font-medium">
        <button
          type="button"
          onClick={() => toggleSort(k)}
          className={cn(
            "inline-flex items-center gap-1 hover:text-foreground",
            sortKey === k && "text-foreground"
          )}
        >
          {label}
          <Icon className="size-3" aria-hidden />
        </button>
      </th>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-md border bg-red-50 px-2.5 py-1 font-medium text-red-700">
          {activeDelayCount} step · {delayedProjectCount} project
        </span>
        <button
          type="button"
          onClick={() => setDivision("all")}
          className={cn(
            "rounded-md border px-2.5 py-1 text-xs",
            division === "all" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
          )}
        >
          Semua divisi
        </button>
        {divisionCounts.map(([div, count]) => (
          <button
            key={div}
            type="button"
            onClick={() => setDivision(division === div ? "all" : div)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium",
              DIVISION_BADGE_STYLES[div].badge,
              division === div && "ring-2 ring-primary ring-offset-1"
            )}
          >
            {getDivisionLabel(div)}
            <span className="rounded bg-white/70 px-1 tabular-nums">{count}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari project, customer, step…"
          className="h-8 w-full sm:w-64"
        />
        <Select value={division} onValueChange={(v) => setDivision(v as "all" | Division)}>
          <SelectTrigger className="h-8 flex-1 sm:w-40 sm:flex-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua divisi</SelectItem>
            {divisionCounts.map(([div]) => (
              <SelectItem key={div} value={div}>
                {getDivisionLabel(div)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as "all" | DelaySummaryStatus)}
        >
          <SelectTrigger className="h-8 flex-1 sm:w-44 sm:flex-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua status</SelectItem>
            {(Object.keys(STATUS_LABELS) as DelaySummaryStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={`${sortKey}:${sortDir}`}
          onValueChange={(v) => {
            const [key, dir] = v.split(":") as [SortKey, SortDir]
            setSortKey(key)
            setSortDir(dir)
          }}
        >
          <SelectTrigger className="h-8 w-full md:hidden">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} dari {rows.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
          {rows.length === 0
            ? "Tidak ada step delay. Semua on-time."
            : "Tidak ada yang cocok dengan filter."}
        </div>
      ) : (
        <>
        <ul className="flex flex-col gap-2 md:hidden">
          {filtered.map((row) => {
            const detail = statusDetail(row)
            return (
              <li key={`${row.projectId}-${row.stepCode}`}>
                <Link
                  href={stepHref(row)}
                  className="flex flex-col gap-1.5 rounded-lg border p-3 active:bg-muted/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{row.projectName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.customerName ?? "Tanpa customer"}
                      </p>
                    </div>
                    {row.overdueHours > 0 && (
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-red-700">
                        {formatDelayDuration(row.overdueHours)}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs">
                    <span className="font-mono">{row.stepCode}</span> · {row.stepName}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <DivisionBadge division={row.division} label={row.divisionLabel} />
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-[11px] font-medium",
                        STATUS_STYLES[row.status]
                      )}
                    >
                      {STATUS_LABELS[row.status]}
                    </span>
                    {detail && (
                      <span className="text-[11px] text-muted-foreground">{detail}</span>
                    )}
                  </div>
                  {row.reason && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      Alasan: {row.reason}
                    </p>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
        <div className="hidden overflow-x-auto rounded-lg border md:block">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                {renderSortHeader("Project", "project")}
                {renderSortHeader("Step", "step")}
                {renderSortHeader("Divisi", "division")}
                {renderSortHeader("Delay", "delay")}
                <th className="px-3 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((row) => {
                const detail = statusDetail(row)
                return (
                  <tr key={`${row.projectId}-${row.stepCode}`} className="hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <Link
                        href={stepHref(row)}
                        className="font-medium hover:underline"
                      >
                        {row.projectName}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {row.customerName ?? "Tanpa customer"}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs">{row.stepCode}</span>
                      <p className="max-w-[240px] truncate text-xs text-muted-foreground">
                        {row.stepName}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <DivisionBadge division={row.division} label={row.divisionLabel} />
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {row.overdueHours > 0 ? (
                        <span className="font-medium text-red-700">
                          {formatDelayDuration(row.overdueHours)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                      <p className="text-xs text-muted-foreground">
                        aktif {formatDelayDuration(row.waitingHours)}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "inline-block rounded-md px-2 py-0.5 text-[11px] font-medium",
                          STATUS_STYLES[row.status]
                        )}
                      >
                        {STATUS_LABELS[row.status]}
                      </span>
                      {detail && (
                        <p className="text-xs text-muted-foreground">{detail}</p>
                      )}
                      {row.reason && (
                        <p
                          className="max-w-[220px] truncate text-xs text-muted-foreground"
                          title={row.reason}
                        >
                          {row.reason}
                        </p>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  )
}
