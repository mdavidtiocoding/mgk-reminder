"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { deleteUser, updateUserDivision, updateUserStatus } from "@/app/actions/users"
import { Button } from "@/components/ui/button"
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
import { formatDate } from "@/lib/format"
import { DIVISION_LABELS, type Division } from "@/lib/steps"

export type UserRow = {
  id: string
  name: string
  email: string
  division: Division | null
  status: ProfileStatus
  created_at: string
}

const PROFILE_STATUSES: ProfileStatus[] = ["pending", "active", "suspended"]

export function UsersTable({
  users,
  currentUserId,
}: {
  users: UserRow[]
  currentUserId: string
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
            <th className="w-[14%] px-3 py-2 font-medium">Nama</th>
            <th className="w-[24%] px-3 py-2 font-medium">Email</th>
            <th className="w-[18%] px-3 py-2 font-medium">Division</th>
            <th className="w-[22%] px-3 py-2 font-medium">Status</th>
            <th className="w-[12%] px-3 py-2 font-medium">Bergabung</th>
            <th className="w-[10%] px-3 py-2 font-medium">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <UserTableRow
              key={user.id}
              user={user}
              isSelf={user.id === currentUserId}
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
}: {
  user: UserRow
  isSelf: boolean
}) {
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

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

  function handleDivisionChange(division: Division) {
    startTransition(async () => {
      await updateUserDivision(user.id, division)
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
        <Select
          value={user.division ?? undefined}
          onValueChange={(v) => handleDivisionChange(v as Division)}
          disabled={isPending}
        >
          <SelectTrigger className="h-8 w-full max-w-[180px]" size="sm">
            <SelectValue placeholder="Pilih division" />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4} className="z-[100]">
            {(Object.entries(DIVISION_LABELS) as [Division, string][]).map(
              ([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
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
      <td className="px-3 py-2">
        {!isSelf ? (
          <>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-xs"
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
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  )
}
