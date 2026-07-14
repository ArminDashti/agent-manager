import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

export const UNCATEGORIZED_KEY = '__uncategorized__'

interface CategoryFilterDropdownProps {
  categories: string[]
  selected: Set<string>
  onChange: (selected: Set<string>) => void
}

function formatLabel(selected: Set<string>, categories: string[]): string {
  if (selected.size === 0) return 'All categories'
  if (selected.size === 1) {
    const only = [...selected][0]
    if (only === UNCATEGORIZED_KEY) return 'Uncategorized'
    return only
  }
  return `${selected.size} selected`
}

export function CategoryFilterDropdown({
  categories,
  selected,
  onChange
}: CategoryFilterDropdownProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const allKeys = useMemo(() => [...categories, UNCATEGORIZED_KEY], [categories])

  const toggle = (key: string) => {
    const next = new Set(selected)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onChange(next)
  }

  const selectAll = () => onChange(new Set(allKeys))
  const clearAll = () => onChange(new Set())

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-600"
      >
        <span>{formatLabel(selected, categories)}</span>
        <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 min-w-[200px] max-h-64 overflow-y-auto bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl py-1">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800">
            <button
              type="button"
              onClick={selectAll}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              Clear all
            </button>
          </div>
          {categories.map((cat) => (
            <label
              key={cat}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.has(cat)}
                onChange={() => toggle(cat)}
              />
              {cat}
            </label>
          ))}
          <label className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 cursor-pointer border-t border-zinc-800">
            <input
              type="checkbox"
              checked={selected.has(UNCATEGORIZED_KEY)}
              onChange={() => toggle(UNCATEGORIZED_KEY)}
            />
            Uncategorized
          </label>
        </div>
      )}
    </div>
  )
}
