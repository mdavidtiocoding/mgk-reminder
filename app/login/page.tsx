import { Suspense } from "react"
import { redirect } from "next/navigation"

import { LoginForm } from "@/components/auth/login-form"
import { ThemePicker } from "@/components/auth/theme-picker"
import { getUiTheme } from "@/lib/ui/theme.server"
import { createClient } from "@/lib/supabase/server"

export default async function LoginPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect("/")
  }

  const theme = await getUiTheme()

  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <Suspense fallback={null}>
          <ThemePicker initialTheme={theme} />
        </Suspense>
        <LoginForm />
      </div>
    </div>
  )
}
