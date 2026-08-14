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
  delayHours: number
}

export function AppConfigForm({
  hoggerDays,
  warningDays,
  delayHours,
}: AppConfigFormProps) {
  const router = useRouter()
  const [hogger, setHogger] = useState(String(hoggerDays))
  const [warning, setWarning] = useState(String(warningDays))
  const [delay, setDelay] = useState(String(delayHours))
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setHogger(String(hoggerDays))
    setWarning(String(warningDays))
    setDelay(String(delayHours))
  }, [hoggerDays, warningDays, delayHours])

  const dirty = useMemo(
    () =>
      parseInt(hogger, 10) !== hoggerDays ||
      parseInt(warning, 10) !== warningDays ||
      parseInt(delay, 10) !== delayHours,
    [hogger, warning, delay, hoggerDays, warningDays, delayHours]
  )

  function handleSave() {
    setMessage(null)
    const hoggerN = parseInt(hogger, 10)
    const warningN = parseInt(warning, 10)
    const delayN = parseInt(delay, 10)
    if (
      isNaN(hoggerN) ||
      hoggerN < 1 ||
      isNaN(warningN) ||
      warningN < 1 ||
      isNaN(delayN) ||
      delayN < 1
    ) {
      setMessage("Nilai harus angka ≥ 1")
      return
    }

    startTransition(async () => {
      const result = await updateAppConfig({
        hoggerDays: hoggerN,
        warningDays: warningN,
        delayHours: delayN,
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
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="delay-hours">Waktu respon (jam)</Label>
          <Input
            id="delay-hours"
            type="number"
            min={1}
            value={delay}
            onChange={(e) => setDelay(e.target.value)}
            disabled={isPending}
            className="h-8"
          />
          <p className="text-xs text-muted-foreground">
            Setelah trigger/unlock, tim punya waktu ini untuk respon (default
            24 jam = 1×24). Baru Delay kalau sudah lewat. Bisa di-override per
            step di Flow Config sesuai urgency.
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
