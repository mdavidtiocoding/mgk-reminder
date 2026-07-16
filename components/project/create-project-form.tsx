"use client"

import Link from "next/link"
import { useState, useTransition } from "react"

import { createProject } from "@/app/actions/create-project"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Customer = {
  id: string
  name: string
}

type CreateProjectFormProps = {
  customers: Customer[]
}

export function CreateProjectForm({ customers }: CreateProjectFormProps) {
  const [mode, setMode] = useState<"existing" | "new">(
    customers.length > 0 ? "existing" : "new"
  )
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)

    if (mode === "existing") {
      formData.set("customerId", customerId)
      formData.delete("newCustomerName")
    } else {
      formData.delete("customerId")
    }

    startTransition(async () => {
      const result = await createProject(formData)
      if (!result.success) {
        setError(result.error)
      }
      // redirect handled by server action on success
    })
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Buat Project Baru</CardTitle>
        <CardDescription>
          Project dimulai di Step 1. Tanggal mulai = hari ini.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Nama project</Label>
            <Input
              id="name"
              name="name"
              placeholder="Lift Tower A - PT Maju Jaya"
              required
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
                disabled={customers.length === 0}
              >
                Pilih existing
              </Button>
              <Button
                type="button"
                variant={mode === "new" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("new")}
              >
                Customer baru
              </Button>
            </div>
          </div>

          {mode === "existing" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="customerId">Pilih customer</Label>
              <Select value={customerId} onValueChange={setCustomerId} required>
                <SelectTrigger id="customerId">
                  <SelectValue placeholder="Pilih customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="newCustomerName">Nama customer baru</Label>
              <Input
                id="newCustomerName"
                name="newCustomerName"
                placeholder="PT Maju Jaya"
                required
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Menyimpan..." : "Buat Project"}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/">Batal</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
