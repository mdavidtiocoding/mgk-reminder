"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { createUser } from "@/app/actions/users"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DIVISION_LABELS, type Division } from "@/lib/steps"

export function CreateUserForm() {
  const router = useRouter()
  const [division, setDivision] = useState<Division>("marketing")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    const form = e.currentTarget
    const formData = new FormData(form)
    formData.set("division", division)

    startTransition(async () => {
      const result = await createUser(formData)
      if (!result.success) {
        setError(result.error)
        return
      }
      setSuccess(true)
      form.reset()
      setDivision("marketing")
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
        <div className="flex flex-col gap-2">
          <Label htmlFor="division">Division</Label>
          <Select value={division} onValueChange={(v) => setDivision(v as Division)}>
            <SelectTrigger id="division">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(DIVISION_LABELS) as [Division, string][]).map(
                ([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
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
