import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://tsmcadpatnmnbkjmqmtx.supabase.co"
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzbWNhZHBhdG5tbmJram1xbXR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjI0MzA5OSwiZXhwIjoyMDk3ODE5MDk5fQ.I0zv8Y0ZSGi6-FgqO0Wzs0hu5PXQrZ84qkwGgXJLsv8"

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const DIVISIONS = ["marketing", "ar", "logistik", "finance", "shipping", "project", "admin"]

const DIVISION_NAMES = {
  marketing: "Dummy Marketing",
  ar: "Dummy Finance AR",
  logistik: "Dummy Logistik",
  finance: "Dummy Finance",
  shipping: "Dummy Shipping",
  project: "Dummy Project",
  admin: "Dummy Admin",
}

async function main() {
  for (const division of DIVISIONS) {
    const email = `${division}@dummy.com`
    const password = `${division}123`
    const name = DIVISION_NAMES[division]

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (error) {
      if (error.message.includes("already been registered")) {
        console.log(`⚠️  ${email} sudah ada, skip`)
        continue
      }
      console.error(`❌ Error creating ${email}:`, error.message)
      continue
    }

    const userId = data.user.id

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: userId,
      name,
      email,
      division,
      status: "active",
      notif_email: true,
      notif_push: false,
      notif_google_calendar: false,
    })

    if (profileError) {
      console.error(`❌ Profile error ${email}:`, profileError.message)
    } else {
      console.log(`✅ ${email} / ${password}`)
    }
  }

  console.log("\nSelesai!")
}

main()
