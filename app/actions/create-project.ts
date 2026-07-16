"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { notifyDivisionForStep } from "@/lib/notifications/send"
import { createClient } from "@/lib/supabase/server"

export type CreateProjectResult =
  | { success: true; projectId: string }
  | { success: false; error: string }

export async function createProject(formData: FormData): Promise<CreateProjectResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Silakan login terlebih dahulu." }
  }

  const name = (formData.get("name") as string)?.trim()
  const customerId = (formData.get("customerId") as string)?.trim()
  const newCustomerName = (formData.get("newCustomerName") as string)?.trim()

  if (!name) {
    return { success: false, error: "Nama project wajib diisi." }
  }

  let resolvedCustomerId = customerId || null

  if (newCustomerName) {
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .insert({ name: newCustomerName })
      .select("id")
      .single()

    if (customerError) {
      return { success: false, error: customerError.message }
    }

    resolvedCustomerId = customer.id
  }

  if (!resolvedCustomerId) {
    return { success: false, error: "Pilih customer atau tambah customer baru." }
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      name,
      customer_id: resolvedCustomerId,
      status: "active",
      created_by: user.id,
    })
    .select("id")
    .single()

  if (projectError) {
    return { success: false, error: projectError.message }
  }

  // Notify Marketing immediately when project is created (M1 unlocked)
  await notifyDivisionForStep({
    projectId: project.id,
    projectName: name,
    stepCode: "M1",
    type: "step_unlock",
  })

  revalidatePath("/")
  redirect(`/projects/${project.id}`)
}
