"use client"

import { useMemo, useState, useTransition, Fragment } from "react"
import { useRouter } from "next/navigation"

import { saveRolePermissions } from "@/app/actions/role-permissions"
import { Button } from "@/components/ui/button"
import {
  PERMISSION_GROUPS,
  PERMISSION_KEYS,
  PERMISSION_LABELS,
  ROLE_KEYS,
  getRoleLabel,
  type PermissionKey,
  type RoleKey,
  type RolePermissionsMatrix,
} from "@/lib/auth/permissions"
import { cn } from "@/lib/utils"

type RolePermissionsMatrixFormProps = {
  initialMatrix: RolePermissionsMatrix
}

export function RolePermissionsMatrixForm({
  initialMatrix,
}: RolePermissionsMatrixFormProps) {
  const router = useRouter()
  const [matrix, setMatrix] = useState(initialMatrix)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  const dirty = useMemo(
    () => JSON.stringify(matrix) !== JSON.stringify(initialMatrix),
    [matrix, initialMatrix]
  )

  function toggle(role: RoleKey, key: PermissionKey) {
    if (role === "admin" && key === "settings_permissions") return
    setSaved(false)
    setMatrix((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [key]: !prev[role][key],
      },
    }))
  }

  function setRoleAll(role: RoleKey, value: boolean) {
    setSaved(false)
    setMatrix((prev) => ({
      ...prev,
      [role]: Object.fromEntries(
        PERMISSION_KEYS.map((key) => [
          key,
          role === "admin" && key === "settings_permissions" ? true : value,
        ])
      ) as Record<PermissionKey, boolean>,
    }))
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = await saveRolePermissions(matrix)
      if (!result.success) {
        setError(result.error)
        return
      }
      setSaved(true)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Centang akses per role (divisi). User dengan beberapa divisi mendapat
        gabungan centangan. Role Admin tidak bisa kehilangan akses ke matriks
        ini.
      </p>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[52rem] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="sticky left-0 z-10 bg-muted/40 px-3 py-2.5 text-left font-medium">
                Akses
              </th>
              {ROLE_KEYS.map((role) => (
                <th
                  key={role}
                  className="px-2 py-2.5 text-center font-medium whitespace-nowrap"
                >
                  <div className="flex flex-col items-center gap-1">
                    <span>{getRoleLabel(role)}</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="text-[10px] text-primary hover:underline"
                        onClick={() => setRoleAll(role, true)}
                      >
                        Semua
                      </button>
                      <span className="text-[10px] text-muted-foreground">/</span>
                      <button
                        type="button"
                        className="text-[10px] text-muted-foreground hover:underline"
                        onClick={() => setRoleAll(role, false)}
                      >
                        Kosong
                      </button>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_GROUPS.map((group) => (
              <Fragment key={group.title}>
                <tr className="border-b bg-muted/20">
                  <td
                    colSpan={ROLE_KEYS.length + 1}
                    className="px-3 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                  >
                    {group.title}
                  </td>
                </tr>
                {group.keys.map((key) => (
                  <tr key={key} className="border-b last:border-0">
                    <td className="sticky left-0 z-10 bg-background px-3 py-2.5">
                      {PERMISSION_LABELS[key]}
                    </td>
                    {ROLE_KEYS.map((role) => {
                      const locked =
                        role === "admin" && key === "settings_permissions"
                      const checked = matrix[role][key]
                      return (
                        <td key={role} className="px-2 py-2 text-center">
                          <input
                            type="checkbox"
                            className={cn(
                              "size-4 rounded border accent-primary",
                              locked && "cursor-not-allowed opacity-60"
                            )}
                            checked={checked}
                            disabled={locked || isPending}
                            onChange={() => toggle(role, key)}
                            aria-label={`${PERMISSION_LABELS[key]} — ${getRoleLabel(role)}`}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {saved && !dirty && (
        <p className="text-sm text-emerald-700">Tersimpan.</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!dirty || isPending}
          onClick={handleSave}
        >
          {isPending ? "Menyimpan…" : "Simpan akses"}
        </Button>
        {dirty && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={() => {
              setMatrix(initialMatrix)
              setError(null)
              setSaved(false)
            }}
          >
            Batalkan
          </Button>
        )}
      </div>
    </div>
  )
}
