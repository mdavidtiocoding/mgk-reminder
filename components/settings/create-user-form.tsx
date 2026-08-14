"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { createUser } from "@/app/actions/users"
import { DivisionMultiSelect } from "@/components/settings/division-multi-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Division } from "@/lib/steps"

export function CreateUserForm({
  canAssignSuperAdmin = false,
}: {
  canAssignSuperAdmin?: boolean
}) {
  const router = useRouter()
  const [divisions, setDivisions] = useState<Division[]>(["marketing"])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    const form = e.currentTarget
    const formData = new FormData(form)
    formData.set("divisions", JSON.stringify(divisions))

    startTransition(async () => {
      const result = await createUser(formData)
      if (!result.success) {
        setError(result.error)
        return
      }
      setSuccess(true)
      form.reset()
      setDivisions(["marketing"])
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Nama</Label>
          <Input id="name" name="name" required placeholder="Budi Santoso" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="budi@perusahaan.com"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password awal</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            placeholder="Min. 6 karakter"
          />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label>Divisi</Label>
          <DivisionMultiSelect
            value={divisions}
            onChange={setDivisions}
            includeSuperAdmin={canAssignSuperAdmin}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm text-muted-foreground">
          User berhasil dibuat. Mereka bisa login dengan email + password di atas.
        </p>
      )}

      <Button type="submit" size="sm" className="w-fit" disabled={isPending}>
        {isPending ? "Menyimpan..." : "Tambah User"}
      </Button>
    </form>
  )
}
