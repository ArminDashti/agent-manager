import { useEffect, useRef } from 'react'
import { cn } from '@renderer/lib/utils'

export interface TableColumn<T> {
  key: string
  label: string
  sortable?: boolean
  className?: string
  renderHeader?: () => React.ReactNode
  render: (row: T) => React.ReactNode
}

interface ResourceTableProps<T> {
  columns: TableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  sortKey?: string
  sortDir?: 'asc' | 'desc'
  onSort?: (key: string) => void
  onRowClick?: (row: T) => void
  emptyMessage?: string
}

export function ResourceTable<T>({
  columns,
  rows,
  rowKey,
  sortKey,
  sortDir,
  onSort,
  onRowClick,
  emptyMessage = 'No items found'
}: ResourceTableProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // #region agent log
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const parent = el.parentElement
    const data = {
      rowCount: rows.length,
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      canScroll: el.scrollHeight > el.clientHeight + 1,
      parentClientHeight: parent?.clientHeight ?? null,
      parentScrollHeight: parent?.scrollHeight ?? null,
      parentOverflow: parent ? getComputedStyle(parent).overflow : null,
      elOverflow: getComputedStyle(el).overflow,
      elMinHeight: getComputedStyle(el).minHeight,
      runId: 'post-fix'
    }
    void window.agentManager.debugLog('C', 'ResourceTable.tsx:layout', 'table scroll metrics', data)
    fetch('http://127.0.0.1:7919/ingest/7067de5c-1d6a-4e66-b02e-a794cb173e15',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c00194'},body:JSON.stringify({sessionId:'c00194',location:'ResourceTable.tsx:layout',message:'table scroll metrics',data,timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{})
  }, [rows])
  // #endregion

  return (
    <div ref={scrollRef} className="overflow-auto flex-1 min-h-0">
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0 bg-zinc-950 z-10">
          <tr className="border-b border-zinc-800 text-left text-zinc-400">
            {columns.map((col) => (
              <th key={col.key} className={cn('px-4 py-2 font-medium', col.className)}>
                {col.renderHeader ? (
                  col.renderHeader()
                ) : col.sortable && onSort ? (
                  <button
                    type="button"
                    onClick={() => onSort(col.key)}
                    className="hover:text-zinc-200 flex items-center gap-1"
                  >
                    {col.label}
                    {sortKey === col.key && (
                      <span className="text-xs">{sortDir === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                ) : (
                  col.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-zinc-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'border-b border-zinc-900 hover:bg-zinc-900/50 transition-colors',
                  onRowClick && 'cursor-pointer'
                )}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-4 py-2.5', col.className)}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
