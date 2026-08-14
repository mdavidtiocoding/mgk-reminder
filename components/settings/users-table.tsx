"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { deleteUser, updateUserDivisions, updateUserName, updateUserStatus } from "@/app/actions/users"
import {
  DivisionMultiSelect,
  formatDivisionSelection,
} from "@/components/settings/division-multi-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  PROFILE_STATUS_LABELS,
  type ProfileStatus,
} from "@/lib/auth/profile-status"
import { resolveUserDivisions } from "@/lib/auth/user-divisions"
import { formatDate } from "@/lib/format"
import type { Division } from "@/lib/steps"

export type UserRow = {
  id: string
  name: string
  email: string
  division: Division | null
  divisions?: Division[] | null
  status: ProfileStatus
  created_at: string
}

const PROFILE_STATUSES: ProfileStatus[] = ["pending", "active", "suspended"]

export function UsersTable({
  users,
  currentUserId,
  canAssignSuperAdmin = false,
}: {
  users: UserRow[]
  currentUserId: string
  canAssignSuperAdmin?: boolean
}) {
  if (users.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Belum ada user terdaftar.</p>
    )
  }

  return (
    <div className="rounded-lg border">
      <table className="w-full table-fixed text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left">
            <th className="w-[16%] px-3 py-2 font-medium">Nama</th>
            <th className="w-[26%] px-3 py-2 font-medium">Email</th>
            <th className="w-[18%] px-3 py-2 font-medium">Divisi</th>
            <th className="w-[18%] px-3 py-2 font-medium">Status</th>
            <th className="w-[12%] px-3 py-2 font-medium">Bergabung</th>
            <th className="w-px whitespace-nowrap px-3 py-2 font-medium">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <UserTableRow
              key={user.id}
              user={user}
              isSelf={user.id === currentUserId}
              canAssignSuperAdmin={canAssignSuperAdmin}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function UserTableRow({
  user,
  isSelf,
  canAssignSuperAdmin = false,
}: {
  user: UserRow
  isSelf: boolean
  canAssignSuperAdmin?: boolean
}) {
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [divisionOpen, setDivisionOpen] = useState(false)
  const [divisionError, setDivisionError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const currentDivisions = resolveUserDivisions(user)
  const [draftDivisions, setDraftDivisions] = useState<Division[]>(currentDivisions)
  const [draftName, setDraftName] = useState(user.name)

  function openDivisionDialog() {
    setDraftDivisions(currentDivisions)
    setDivisionError(null)
    setDivisionOpen(true)
  }

  function openEditDialog() {
    setDraftName(user.name)
    setEditError(null)
    setEditOpen(true)
  }

  function handleDelete() {
    setDeleteError(null)
    startTransition(async () => {
      const result = await deleteUser(user.id)
      if (!result.success) {
        setDeleteError(result.error)
        return
      }
      setDeleteOpen(false)
      router.refresh()
    })
  }

  function handleSaveName() {
    setEditError(null)
    startTransition(async () => {
      const result = await updateUserName(user.id, draftName)
      if (!result.success) {
        setEditError(result.error)
        return
      }
      setEditOpen(false)
      router.refresh()
    })
  }

  function handleSaveDivisions() {
    setDivisionError(null)
    startTransition(async () => {
      const result = await updateUserDivisions(user.id, draftDivisions)
      if (!result.success) {
        setDivisionError(result.error)
        return
      }
      setDivisionOpen(false)
      router.refresh()
    })
  }

  function handleStatusChange(status: ProfileStatus) {
    startTransition(async () => {
      await updateUserStatus(user.id, status)
      router.refresh()
    })
  }

  return (
    <tr className="border-b last:border-b-0">
      <td className="px-3 py-2 font-medium">{user.name}</td>
      <td className="truncate px-3 py-2 text-muted-foreground" title={user.email}>
        {user.email}
      </td>
      <td className="px-3 py-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 max-w-[180px] justify-start truncate text-xs font-normal"
          disabled={isPending}
          onClick={openDivisionDialog}
        >
          {formatDivisionSelection(currentDivisions)}
        </Button>
        <Dialog open={divisionOpen} onOpenChange={setDivisionOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Divisi — {user.name}</DialogTitle>
              <DialogDescription>
                Satu user bisa punya lebih dari satu divisi (mis. Logistik + Finance).
              </DialogDescription>
            </DialogHeader>
            <DivisionMultiSelect
              value={draftDivisions}
              onChange={setDraftDivisions}
              disabled={isPending}
              includeSuperAdmin={canAssignSuperAdmin}
            />
            {divisionError && (
              <p className="text-sm text-destructive" role="alert">
                {divisionError}
              </p>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                disabled={isPending}
                onClick={() => setDivisionOpen(false)}
              >
                Batal
              </Button>
              <Button disabled={isPending} onClick={handleSaveDivisions}>
                {isPending ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </td>
      <td className="px-3 py-2">
        {isSelf ? (
          <span className="text-sm">{PROFILE_STATUS_LABELS[user.status]}</span>
        ) : (
          <Select
            value={user.status}
            onValueChange={(v) => handleStatusChange(v as ProfileStatus)}
            disabled={isPending}
          >
            <SelectTrigger className="h-8 w-full max-w-[200px]" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4} className="z-[100]">
              {PROFILE_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {PROFILE_STATUS_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </td>
      <td className="px-3 py-2 text-muted-foreground">
        {formatDate(user.created_at)}
      </td>
      <td className="whitespace-nowrap px-3 py-2">
        <div className="flex flex-nowrap items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-7 shrink-0 px-2.5 text-xs"
            disabled={isPending}
            onClick={openEditDialog}
          >
            Edit
          </Button>
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit user</DialogTitle>
                <DialogDescription>
                  Ubah nama tampilan. Nama ini muncul di &quot;Selesai oleh&quot;
                  dan daftar user.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`edit-name-${user.id}`}>Nama</Label>
                  <Input
                    id={`edit-name-${user.id}`}
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    disabled={isPending}
                    maxLength={80}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              {editError && (
                <p className="text-sm text-destructive" role="alert">
                  {editError}
                </p>
              )}
              <DialogFooter>
                <Button
                  variant="outline"
                  disabled={isPending}
                  onClick={() => setEditOpen(false)}
                >
                  Batal
                </Button>
                <Button disabled={isPending} onClick={handleSaveName}>
                  {isPending ? "Menyimpan..." : "Simpan"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {!isSelf ? (
            <>
              <Button
                size="sm"
                variant="destructive"
                className="h-7 shrink-0 px-2.5 text-xs"
                disabled={isPending}
                onClick={() => {
                  setDeleteError(null)
                  setDeleteOpen(true)
                }}
              >
                Hapus
              </Button>
              <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Hapus user?</DialogTitle>
                    <DialogDescription>
                      User <strong>{user.name}</strong> ({user.email}) akan
                      dihapus permanen dari sistem. Tindakan ini tidak bisa
                      dibatalkan.
                    </DialogDescription>
                  </DialogHeader>
                  {deleteError && (
                    <p className="text-sm text-destructive" role="alert">
                      {deleteError}
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
                      {isPending ? "Menghapus..." : "Hapus user"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          ) : null}
        </div>
      </td>
    </tr>
  )
}
