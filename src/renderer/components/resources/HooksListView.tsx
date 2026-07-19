import { useMemo, useState } from 'react'
import type { ResourceGroupSummary, UiFilterState } from '@shared/types'
import { CURSOR_HOOK_EVENTS, hookEventSortIndex } from '@shared/hook-events'
import { formatDateWithRelative } from '@shared/utils.browser'
import { Download, Sparkles, Trash2 } from 'lucide-react'
import { ResourceTable } from './ResourceTable'
import { ResourceListToolbar } from './ResourceListToolbar'
import { OpenRouterRefactorModal } from './OpenRouterRefactorModal'
import { useAppStore } from '@renderer/stores/appStore'
import { ALL_PROJECTS_KEY } from './ProjectFilterDropdown'

interface HooksListViewProps {
  summaries: ResourceGroupSummary[]
  loading: boolean
  filterState: UiFilterState
  onFilterChange: (patch: Partial<UiFilterState>) => void
  onAssign: (name: string) => void
  onEdit: (name: string) => void
  onAdd?: () => void
  onRename?: (oldName: string, newName: string) => Promise<void>
  onDelete: (name: string) => Promise<void>
}

function buildHookColumns(
  onAssign: (name: string) => void,
  onDelete: (name: string) => void,
  onRefactor: (name: string) => void,
  onRename?: (oldName: string, newName: string) => Promise<void>
) {
  const stopProp = (e: React.MouseEvent) => e.stopPropagation()

  return [
    {
      key: 'name',
      label: 'Name',
      render: (row: ResourceGroupSummary) =>
        onRename ? (
          <input
            type="text"
            defaultValue={row.name}
            key={`${row.name}-hook-name`}
            onClick={stopProp}
            onBlur={(e) => {
              const next = e.target.value.trim()
              if (next && next !== row.name) void onRename(row.name, next)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
            className="w-full bg-transparent border border-transparent hover:border-zinc-700 focus:border-zinc-600 rounded px-1 py-0.5 text-sm font-medium text-zinc-200"
          />
        ) : (
          <span className="font-medium text-zinc-200">{row.name}</span>
        )
    },
    {
      key: 'description',
      label: 'Description',
      className: 'max-w-xs',
      render: (row: ResourceGroupSummary) => (
        <span className="block truncate text-zinc-400 max-w-[240px]" title={row.description || undefined}>
          {row.description || '—'}
        </span>
      )
    },
    {
      key: 'projects',
      label: 'Projects',
      render: (row: ResourceGroupSummary) => (
        <span className="text-zinc-400">
          {row.usedProjectCount}/{row.totalProjectCount}
        </span>
      )
    },
    {
      key: 'tokens',
      label: 'Tokens',
      render: (row: ResourceGroupSummary) => (
        <span className="text-zinc-400">{row.tokenEstimate.toLocaleString()}</span>
      )
    },
    {
      key: 'updated',
      label: 'Last updated',
      render: (row: ResourceGroupSummary) => (
        <span className="text-zinc-500">{formatDateWithRelative(row.lastUpdatedAt)}</span>
      )
    },
    {
      key: 'assign',
      label: '',
      className: 'w-20',
      render: (row: ResourceGroupSummary) => (
        <button
          type="button"
          onClick={(e) => {
            stopProp(e)
            onAssign(row.name)
          }}
          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-blue-400"
          title="Install"
        >
          <Download size={14} />
        </button>
      )
    },
    {
      key: 'refactor',
      label: '',
      className: 'w-20',
      render: (row: ResourceGroupSummary) => (
        <button
          type="button"
          onClick={(e) => {
            stopProp(e)
            onRefactor(row.name)
          }}
          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-violet-400"
          title="Refactor by OpenRouter"
        >
          <Sparkles size={14} />
        </button>
      )
    },
    {
      key: 'delete',
      label: '',
      className: 'w-20',
      render: (row: ResourceGroupSummary) => (
        <button
          type="button"
          onClick={(e) => {
            stopProp(e)
            void onDelete(row.name)
          }}
          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-red-400"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      )
    }
  ]
}

export function HooksListView({
  summaries,
  loading,
  filterState,
  onFilterChange,
  onAssign,
  onEdit,
  onAdd,
  onRename,
  onDelete
}: HooksListViewProps) {
  const { settings } = useAppStore()
  const [refactorTarget, setRefactorTarget] = useState<string | null>(null)
  const { search, hideSingleProject, selectedProjectId, sortKey, sortDir } = filterState

  const projects = useMemo(
    () => settings?.projectRoots.flatMap((r) => r.projects).sort((a, b) => a.name.localeCompare(b.name)) ?? [],
    [settings]
  )

  const filtered = useMemo(() => {
    let rows = summaries
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      rows = rows.filter((r) => [r.name, r.description].join(' ').toLowerCase().includes(q))
    }
    if (selectedProjectId !== ALL_PROJECTS_KEY) {
      rows = rows.filter((r) => r.assignedProjectIds.includes(selectedProjectId))
    }
    if (hideSingleProject) {
      rows = rows.filter((r) => r.usedProjectCount !== 1)
    }
    return [...rows].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortKey === 'updated') {
        return (
          ((a.lastUpdatedAt ? new Date(a.lastUpdatedAt).getTime() : 0) -
            (b.lastUpdatedAt ? new Date(b.lastUpdatedAt).getTime() : 0)) *
          dir
        )
      }
      return a.name.localeCompare(b.name) * dir
    })
  }, [summaries, search, hideSingleProject, selectedProjectId, sortKey, sortDir])

  const sections = useMemo(() => {
    const grouped = new Map<string, ResourceGroupSummary[]>()
    for (const row of filtered) {
      const event = row.event ?? 'Other'
      const list = grouped.get(event) ?? []
      list.push(row)
      grouped.set(event, list)
    }

    const orderedEvents = [
      ...CURSOR_HOOK_EVENTS,
      ...[...grouped.keys()].filter((e) => !(CURSOR_HOOK_EVENTS as readonly string[]).includes(e))
    ]

    return orderedEvents
      .filter((event) => grouped.has(event))
      .sort((a, b) => hookEventSortIndex(a) - hookEventSortIndex(b))
      .map((event) => ({ event, rows: grouped.get(event)! }))
  }, [filtered])

  const columns = useMemo(
    () => buildHookColumns(onAssign, onDelete, setRefactorTarget, onRename),
    [onAssign, onDelete, onRename]
  )

  const handleSort = (key: string) => {
    if (sortKey === key) {
      onFilterChange({ sortDir: sortDir === 'asc' ? 'desc' : 'asc' })
    } else {
      onFilterChange({ sortKey: key, sortDir: 'asc' })
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="px-4 py-3 border-b border-zinc-800">
        <h2 className="text-lg font-medium">Hooks</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Cursor only</p>
      </header>
      <ResourceListToolbar
        search={search}
        onSearchChange={(value) => onFilterChange({ search: value })}
        hideSingleProject={hideSingleProject}
        onHideSingleProjectChange={(value) => onFilterChange({ hideSingleProject: value })}
        onAdd={onAdd}
        showProjectFilter
        projects={projects}
        selectedProjectId={selectedProjectId}
        onProjectFilterChange={(value) => onFilterChange({ selectedProjectId: value })}
      />
      {loading && summaries.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">Loading…</div>
      ) : sections.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">No hooks found</div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">
          {sections.map(({ event, rows }) => (
            <section key={event} className="border-b border-zinc-800 last:border-b-0">
              <div className="px-4 py-2 bg-zinc-900/50 sticky top-0 z-10">
                <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-400">{event}</h3>
              </div>
              <ResourceTable
                columns={columns}
                rows={rows}
                rowKey={(r) => r.name}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
                onRowClick={(row) => onEdit(row.name)}
              />
            </section>
          ))}
        </div>
      )}
      {refactorTarget && (
        <OpenRouterRefactorModal
          resourceType="hook"
          resourceName={refactorTarget}
          onClose={() => setRefactorTarget(null)}
        />
      )}
    </div>
  )
}
