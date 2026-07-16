"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import {
  createAdhocCase,
  resolveAdhocCase,
} from "@/app/actions/adhoc-cases"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatDateTime } from "@/lib/format"

export type AdhocCaseItem = {
  id: string
  description: string
  status: "open" | "resolved"
  createdAt: string
  resolvedAt: string | null
  note: string | null
  createdByName?: string
}

type AdhocCasesPanelProps = {
  projectId: string
  cases: AdhocCaseItem[]
  canManage: boolean
}

export function AdhocCasesPanel({
  projectId,
  cases,
  canManage,
}: AdhocCasesPanelProps) {
  const router = useRouter()
  const [description, setDescription] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const result = await createAdhocCase(projectId, description)
      if (!result.success) {
        setError(result.error)
        return
      }
      setDescription("")
      router.refresh()
    })
  }

  function handleResolve(caseId: string, note: string) {
    startTransition(async () => {
      const result = await resolveAdhocCase(caseId, projectId, note)
      if (!result.success) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  const openCount = cases.filter((c) => c.status === "open").length

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-medium">Ad-hoc Cases (Step 17)</h3>
        <p className="text-sm text-muted-foreground">
          Laporkan kerusakan / kekurangan barang.{" "}
          {openCount > 0 && (
            <span className="text-foreground">{openCount} case terbuka</span>
          )}
        </p>
      </div>

      {canManage && (
        <form onSubmit={handleCreate} className="flex flex-col gap-2">
          <Label htmlFor="adhoc-desc">Case baru</Label>
          <Input
            id="adhoc-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Contoh: Panel kontrol rusak, 2 unit kurang..."
            disabled={isPending}
          />
          <Button type="submit" size="sm" className="w-fit" disabled={isPending}>
            {isPending ? "Menyimpan..." : "Tambah Case"}
          </Button>
        </form>
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {cases.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada ad-hoc case.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {cases.map((item) => (
            <AdhocCaseRow
              key={item.id}
              item={item}
              canManage={canManage}
              isPending={isPending}
              onResolve={handleResolve}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function AdhocCaseRow({
  item,
  canManage,
  isPending,
  onResolve,
}: {
  item: AdhocCaseItem
  canManage: boolean
  isPending: boolean
  onResolve: (caseId: string, note: string) => void
}) {
  const [resolveNote, setResolveNote] = useState("")

  return (
    <li className="rounded-lg border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-medium">{item.description}</p>
        <Badge variant={item.status === "open" ? "destructive" : "secondary"}>
          {item.status === "open" ? "Open" : "Resolved"}
        </Badge>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {item.createdByName ? `${item.createdByName} · ` : ""}
        {formatDateTime(item.createdAt)}
      </p>
      {item.status === "resolved" && item.resolvedAt && (
        <p className="mt-1 text-xs text-muted-foreground">
          Selesai: {formatDateTime(item.resolvedAt)}
          {item.note ? ` — ${item.note}` : ""}
        </p>
      )}
      {item.status === "open" && canManage && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor={`resolve-${item.id}`} className="text-xs">
              Catatan penyelesaian (opsional)
            </Label>
            <Input
              id={`resolve-${item.id}`}
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              placeholder="Tindakan yang sudah dilakukan..."
              disabled={isPending}
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => onResolve(item.id, resolveNote)}
          >
            Tandai Resolved
          </Button>
        </div>
      )}
    </li>
  )
}
