import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

interface CollapsibleNavGroupProps {
  label: string
  storageKey: string
  defaultOpen?: boolean
  collapsed?: boolean
  children: React.ReactNode
}

export function CollapsibleNavGroup({
  label,
  storageKey,
  defaultOpen = true,
  collapsed = false,
  children
}: CollapsibleNavGroupProps) {
  const [open, setOpen] = useState(() => {
    const stored = localStorage.getItem(storageKey)
    if (stored !== null) return stored === 'true'
    return defaultOpen
  })

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev
      localStorage.setItem(storageKey, String(next))
      return next
    })
  }

  if (collapsed) {
    return <div className="space-y-0.5 pt-1">{children}</div>
  }

  return (
    <div className="pt-2">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center gap-1 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500 hover:text-zinc-300"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {label}
      </button>
      <div className={cn('space-y-0.5', !open && 'hidden')}>{children}</div>
    </div>
  )
}
