"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { Input } from "@/components/ui/input"

type UrlSearchInputProps = {
  paramKey?: string
  placeholder?: string
  className?: string
}

export function UrlSearchInput({
  paramKey = "q",
  placeholder = "Cari…",
  className,
}: UrlSearchInputProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const current = searchParams.get(paramKey) ?? ""
  const [value, setValue] = useState(current)

  useEffect(() => {
    setValue(current)
  }, [current])

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      const trimmed = value.trim()
      if (trimmed) {
        params.set(paramKey, trimmed)
      } else {
        params.delete(paramKey)
      }
      const query = params.toString()
      const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname
      const currentUrl = window.location.pathname + window.location.search
      if (nextUrl !== currentUrl) {
        router.push(nextUrl)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [value, paramKey, router, searchParams])

  return (
    <Input
      type="search"
      placeholder={placeholder}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className={className ?? "w-full max-w-sm"}
    />
  )
}
