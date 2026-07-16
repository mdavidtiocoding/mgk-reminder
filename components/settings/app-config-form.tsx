"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { updateAppConfig } from "@/app/actions/settings"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type AppConfigFormProps = {
  hoggerDays: number
  warningDays: number
}

export function AppConfigForm({ hoggerDays, warningDays }: AppConfigFormProps) {
  const router = useRouter()
  const [hogger, setHogger] = useState(String(hoggerDays))
  const [warning, setWarning] = useState(String(warningDays))
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setHogger(String(hoggerDays))
    setWarning(String(warningDays))
  }, [hoggerDays, warningDays])

  const dirty = useMemo(
    () =>
      parseInt(hogger, 10) !== hoggerDays ||
      parseInt(warning, 10) !== warningDays,
    [hogger, warning, hoggerDays, warningDays]
  )

  function handleSave() {
    setMessage(null)
    const hoggerN = parseInt(hogger, 10)
    const warningN = parseInt(warning, 10)
    if (isNaN(hoggerN) || hoggerN < 1 || isNaN(warningN) || warningN < 1) {
      setMessage("Nilai harus angka ≥ 1")
      return
    }

    startTransition(async () => {
      const result = await updateAppConfig({
        hoggerDays: hoggerN,
        warningDays: warningN,
      })
      if (!result.success) {
        setMessage(result.error ?? "Gagal menyimpan")
        return
      }
      setMessage("Tersimpan")
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hogger-days">Hogger threshold (hari)</Label>
          <Input
            id="hogger-days"
            type="number"
            min={1}
            value={hogger}
            onChange={(e) => setHogger(e.target.value)}
            disabled={isPending}
            className="h-8"
          />
          <p className="text-xs text-muted-foreground">
            Step aktif lebih lama dari ini ditandai HOGGER.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="warning-days">Warning threshold (hari)</Label>
          <Input
            id="warning-days"
            type="number"
            min={1}
            value={warning}
            onChange={(e) => setWarning(e.target.value)}
            disabled={isPending}
            className="h-8"
          />
          <p className="text-xs text-muted-foreground">
            Teks &quot;waiting since&quot; berubah merah setelah ini.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={handleSave} disabled={isPending || !dirty}>
          {isPending ? "Menyimpan..." : "Simpan"}
        </Button>
        {message && (
          <p className="text-sm text-muted-foreground" role="status">
            {message}
          </p>
        )}
      </div>
    </div>
  )
}
