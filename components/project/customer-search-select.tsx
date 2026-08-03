"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Check, ChevronDown, Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/** ~5 baris visible; sisanya scroll. */
const LIST_MAX_HEIGHT_PX = 160
const DROPDOWN_GAP_PX = 4

type CustomerOption = {
  id: string
  name: string
}

type CustomerSearchSelectProps = {
  customers: CustomerOption[]
  value: string
  onValueChange: (value: string) => void
  id?: string
  disabled?: boolean
  placeholder?: string
}

type DropdownCoords = {
  left: number
  width: number
  top?: number
  bottom?: number
}

export function CustomerSearchSelect({
  customers,
  value,
  onValueChange,
  id,
  disabled = false,
  placeholder = "Pilih customer",
}: CustomerSearchSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [mounted, setMounted] = useState(false)
  const [coords, setCoords] = useState<DropdownCoords>({ left: 0, width: 0 })
  const [placement, setPlacement] = useState<"bottom" | "top">("bottom")

  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selected = customers.find((customer) => customer.id === value)

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return customers
    return customers.filter((customer) =>
      customer.name.toLowerCase().includes(query)
    )
  }, [customers, search])

  useEffect(() => {
    setMounted(true)
  }, [])

  function updatePosition() {
    const trigger = triggerRef.current
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    const estimatedHeight = 52 + LIST_MAX_HEIGHT_PX
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const openUp = spaceBelow < estimatedHeight && spaceAbove > spaceBelow

    setPlacement(openUp ? "top" : "bottom")
    setCoords({
      left: rect.left,
      width: rect.width,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + DROPDOWN_GAP_PX }
        : { top: rect.bottom + DROPDOWN_GAP_PX }),
    })
  }

  useEffect(() => {
    if (!open) return

    updatePosition()
    const timer = setTimeout(() => searchRef.current?.focus(), 0)

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return
      }
      setOpen(false)
    }

    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)
    document.addEventListener("mousedown", handlePointerDown)

    return () => {
      clearTimeout(timer)
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
      document.removeEventListener("mousedown", handlePointerDown)
    }
  }, [open])

  useEffect(() => {
    if (!open) setSearch("")
  }, [open])

  function handleSelect(customerId: string) {
    onValueChange(customerId)
    setOpen(false)
  }

  const dropdown = open && mounted && (
    <div
      ref={dropdownRef}
      style={{
        position: "fixed",
        left: coords.left,
        width: coords.width,
        top: placement === "bottom" ? coords.top : undefined,
        bottom: placement === "top" ? coords.bottom : undefined,
        zIndex: 50,
      }}
      className="overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10"
    >
      <div className="border-b p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari customer..."
            className="h-8 border-input pl-8 shadow-none focus-visible:ring-2"
            aria-label="Cari customer"
          />
        </div>
      </div>

      <ul
        role="listbox"
        aria-label="Daftar customer"
        className="overflow-y-auto p-1"
        style={{ maxHeight: LIST_MAX_HEIGHT_PX }}
      >
        {filtered.length === 0 ? (
          <li className="px-2 py-3 text-center text-sm text-muted-foreground">
            Tidak ada customer cocok
          </li>
        ) : (
          filtered.map((customer) => {
            const isSelected = customer.id === value
            return (
              <li key={customer.id} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                    isSelected
                      ? "bg-primary/10 font-medium text-primary"
                      : "hover:bg-muted"
                  )}
                  onClick={() => handleSelect(customer.id)}
                >
                  <span className="min-w-0 flex-1 truncate">{customer.name}</span>
                  {isSelected && (
                    <Check className="size-4 shrink-0 text-primary" aria-hidden />
                  )}
                </button>
              </li>
            )
          })
        )}
      </ul>
    </div>
  )

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className={cn(
          "flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors outline-none select-none",
          "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          !selected && "text-muted-foreground"
        )}
      >
        <span className="min-w-0 truncate text-left">
          {selected?.name ?? placeholder}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {mounted && dropdown ? createPortal(dropdown, document.body) : null}
    </>
  )
}
