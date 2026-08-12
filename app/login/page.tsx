import { redirect } from "next/navigation"

import { LoginForm } from "@/components/auth/login-form"
import { createClient } from "@/lib/supabase/server"
import { getUiTheme } from "@/lib/ui/theme.server"

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
    <div className="flex min-h-full flex-1 overflow-y-auto p-6 py-8">
      <div className="mx-auto flex w-full max-w-sm flex-col gap-4">
        <LoginForm initialTheme={theme} />
      </div>
    </div>
  )
}
