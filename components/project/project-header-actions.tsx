"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Pencil, Trash2 } from "lucide-react"

import { deleteProject, updateProject, updateProjectStatus } from "@/app/actions/project"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ProjectStatus } from "@/lib/steps"
import { cn } from "@/lib/utils"

type Customer = {
  id: string
  name: string
}

type ProjectHeaderActionsProps = {
  projectId: string
  projectName: string
  customerId: string | null
  status: ProjectStatus
  customers: Customer[]
  isAdmin: boolean
  /** Premium project hero — light controls on dark background */
  tone?: "default" | "dark"
}

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "active", label: "Aktif" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Selesai" },
]

export function ProjectHeaderActions({
  projectId,
  projectName,
  customerId,
  status,
  customers,
  isAdmin,
  tone = "default",
}: ProjectHeaderActionsProps) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState(projectName)
  const [mode, setMode] = useState<"existing" | "new">(
    customers.length > 0 ? "existing" : "new"
  )
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    customerId ?? customers[0]?.id ?? ""
  )
  const [newCustomerName, setNewCustomerName] = useState("")

  function openEdit() {
    setName(projectName)
    setSelectedCustomerId(customerId ?? customers[0]?.id ?? "")
    setMode(customers.length > 0 ? "existing" : "new")
    setNewCustomerName("")
    setError(null)
    setEditOpen(true)
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = await updateProject({
        projectId,
        name,
        customerId: mode === "existing" ? selectedCustomerId : null,
        newCustomerName: mode === "new" ? newCustomerName : null,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      setEditOpen(false)
      router.refresh()
    })
  }

  function handleStatusChange(next: ProjectStatus) {
    if (next === status) return
    startTransition(async () => {
      const result = await updateProjectStatus(projectId, next)
      if (!result.success) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  function handleDelete() {
    setError(null)
    startTransition(async () => {
      const result = await deleteProject(projectId)
      // redirect on success; only land here on failure
      if (result && !result.success) {
        setError(result.error)
      }
    })
  }

  const isDark = tone === "dark"

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isAdmin && (
        <Select
          value={status}
          onValueChange={(v) => handleStatusChange(v as ProjectStatus)}
          disabled={isPending}
        >
          <SelectTrigger
            className={cn(
              "h-8 w-[140px]",
              isDark &&
                "border-white/30 bg-white/10 text-white hover:bg-white/15 [&_svg]:text-white/80"
            )}
            size="sm"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Button
        type="button"
        variant={isDark ? "ghost" : "outline"}
        size="sm"
        className={cn(
          isDark &&
            "border border-white/30 text-white hover:bg-white/10 hover:text-white"
        )}
        onClick={openEdit}
        disabled={isPending}
      >
        <Pencil className="size-3.5" />
        Edit
      </Button>

      {isAdmin && (
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={() => {
            setError(null)
            setDeleteOpen(true)
          }}
          disabled={isPending}
        >
          <Trash2 className="size-3.5" />
          Hapus
        </Button>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Ubah nama project dan customer.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-name">Nama project</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Customer</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={mode === "existing" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMode("existing")}
                  disabled={customers.length === 0 || isPending}
                >
                  Pilih existing
                </Button>
                <Button
                  type="button"
                  variant={mode === "new" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMode("new")}
                  disabled={isPending}
                >
                  Customer baru
                </Button>
              </div>
            </div>

            {mode === "existing" ? (
              <div className="flex flex-col gap-2">
                <Label>Pilih customer</Label>
                <Select
                  value={selectedCustomerId}
                  onValueChange={setSelectedCustomerId}
                  disabled={isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-new-customer">Nama customer baru</Label>
                <Input
                  id="edit-new-customer"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  disabled={isPending}
                />
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={isPending}
              onClick={() => setEditOpen(false)}
            >
              Batal
            </Button>
            <Button disabled={isPending} onClick={handleSave}>
              {isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus project?</DialogTitle>
            <DialogDescription>
              Project <strong>{projectName}</strong> akan dihapus permanen
              beserta semua progress, reminder, dan follow-up. Tindakan ini
              tidak bisa dibatalkan.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={isPending}
              onClick={() => setDeleteOpen(false)}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={handleDelete}
            >
              {isPending ? "Menghapus..." : "Hapus project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
