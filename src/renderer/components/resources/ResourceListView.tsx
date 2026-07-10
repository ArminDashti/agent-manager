import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Download, Pencil, Trash2 } from 'lucide-react'
import type { ResourceGroupSummary, ResourceType } from '@shared/types'
import { ResourceTable } from './ResourceTable'
import { ResourceListToolbar, type ResourceFilter } from './ResourceListToolbar'
import { Toggle } from '@renderer/components/Toggle'
import { showMessage } from '@renderer/stores/messageStore'

type ListableResourceType = Exclude<ResourceType, 'mcp'>

interface ResourceListViewProps {
  title: string
  subtitle?: string
  resourceType: ListableResourceType
  onAssign: (name: string) => void
  onEdit: (name: string) => void
  onRefresh?: () => void
  onAdd?: () => void
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

function isEnhancedList(resourceType: ListableResourceType): resourceType is 'skill' | 'rule' {
  return resourceType === 'skill' || resourceType === 'rule'
}

export function ResourceListView({
  title,
  subtitle,
  resourceType,
  onAssign,
  onEdit,
  onRefresh,
  onAdd
}: ResourceListViewProps) {
  const [summaries, setSummaries] = useState<ResourceGroupSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ResourceFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const enhanced = isEnhancedList(resourceType)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const stats = await window.agentManager.getResourceStats(resourceType)
      setSummaries(stats)
    } finally {
      setLoading(false)
    }
  }, [resourceType])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const handler = () => void load()
    window.addEventListener('scan-changed', handler)
    return () => window.removeEventListener('scan-changed', handler)
  }, [load])

  const categories = useMemo(() => {
    if (!enhanced) return []
    const cats = new Set<string>()
    for (const row of summaries) {
      if (row.category.trim()) cats.add(row.category.trim())
    }
    return [...cats].sort((a, b) => a.localeCompare(b))
  }, [summaries, enhanced])

  const filtered = useMemo(() => {
    let rows = summaries
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      rows = rows.filter((r) => {
        const haystack = [r.name, r.description, r.category].join(' ').toLowerCase()
        return haystack.includes(q)
      })
    }
    if (filter === 'single-project') {
      rows = rows.filter((r) => r.usedProjectCount === 1)
    }
    if (enhanced && categoryFilter !== 'all') {
      if (categoryFilter === '__uncategorized__') {
        rows = rows.filter((r) => !r.category.trim())
      } else {
        rows = rows.filter((r) => r.category.trim() === categoryFilter)
      }
    }
    return [...rows].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      switch (sortKey) {
        case 'category':
          return a.category.localeCompare(b.category) * dir
        case 'description':
          return a.description.localeCompare(b.description) * dir
        case 'projects':
          return (a.usedProjectCount - b.usedProjectCount) * dir
        case 'tokens':
          return (a.tokenEstimate - b.tokenEstimate) * dir
        case 'updated':
          return (
            ((a.lastUpdatedAt ? new Date(a.lastUpdatedAt).getTime() : 0) -
              (b.lastUpdatedAt ? new Date(b.lastUpdatedAt).getTime() : 0)) *
            dir
          )
        default:
          return a.name.localeCompare(b.name) * dir
      }
    })
  }, [summaries, search, filter, categoryFilter, sortKey, sortDir, enhanced])

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const handleMandatory = async (name: string, checked: boolean) => {
    await window.agentManager.setMandatory(resourceType, name, checked)
    await load()
    onRefresh?.()
  }

  const handleCategoryChange = async (name: string, category: string) => {
    if (!enhanced) return
    await window.agentManager.setResourceCategory(resourceType, name, category)
    await load()
    onRefresh?.()
  }

  const handleDelete = async (name: string) => {
    const confirmed = await showMessage({
      message: `Delete "${name}" from all locations? This cannot be undone.`,
      confirm: true,
      type: 'error',
      title: 'Delete resource'
    })
    if (!confirmed) return
    await window.agentManager.deleteResource(resourceType, name)
    await load()
    onRefresh?.()
  }

  const stopProp = (e: React.MouseEvent) => e.stopPropagation()

  const installColumn = {
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
  }

  const deleteColumn = {
    key: 'delete',
    label: '',
    className: 'w-20',
    render: (row: ResourceGroupSummary) => (
      <button
        type="button"
        onClick={(e) => {
          stopProp(e)
          void handleDelete(row.name)
        }}
        className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-red-400"
        title="Delete"
      >
        <Trash2 size={14} />
      </button>
    )
  }

  const mandatoryCheckboxColumn = {
    key: 'mandatory',
    label: 'All projects',
    className: 'w-28',
    render: (row: ResourceGroupSummary) => (
      <input
        type="checkbox"
        checked={row.mandatory}
        onClick={stopProp}
        onChange={(e) => void handleMandatory(row.name, e.target.checked)}
        title="Mandatory for all projects"
      />
    )
  }

  const mandatoryToggleColumn = {
    key: 'mandatory',
    label: 'All projects',
    className: 'w-28',
    render: (row: ResourceGroupSummary) => (
      <Toggle
        checked={row.mandatory}
        onChange={(checked) => void handleMandatory(row.name, checked)}
        title="Mandatory for all projects"
      />
    )
  }

  const legacyColumns = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (row: ResourceGroupSummary) => (
        <span className="font-medium text-zinc-200">{row.name}</span>
      )
    },
    {
      key: 'projects',
      label: 'Projects',
      sortable: true,
      render: (row: ResourceGroupSummary) => (
        <span className="text-zinc-400">
          {row.usedProjectCount}/{row.totalProjectCount}
        </span>
      )
    },
    {
      key: 'tokens',
      label: 'Tokens',
      sortable: true,
      render: (row: ResourceGroupSummary) => (
        <span className="text-zinc-400">{row.tokenEstimate.toLocaleString()}</span>
      )
    },
    {
      key: 'updated',
      label: 'Last updated',
      sortable: true,
      render: (row: ResourceGroupSummary) => (
        <span className="text-zinc-500">{formatDate(row.lastUpdatedAt)}</span>
      )
    },
    installColumn,
    {
      key: 'edit',
      label: '',
      className: 'w-20',
      render: (row: ResourceGroupSummary) => (
        <button
          type="button"
          onClick={() => onEdit(row.name)}
          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400"
          title="Edit"
        >
          <Pencil size={14} />
        </button>
      )
    },
    deleteColumn,
    mandatoryCheckboxColumn
  ]

  const enhancedColumns = [
    {
      key: 'category',
      label: 'Category',
      sortable: true,
      className: 'w-36',
      render: (row: ResourceGroupSummary) => (
        <input
          type="text"
          defaultValue={row.category}
          key={`${row.name}-${row.category}`}
          placeholder="—"
          onClick={stopProp}
          onBlur={(e) => {
            if (e.target.value.trim() !== row.category) {
              void handleCategoryChange(row.name, e.target.value)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur()
            }
          }}
          className="w-full bg-transparent border border-transparent hover:border-zinc-700 focus:border-zinc-600 rounded px-1 py-0.5 text-sm text-zinc-300"
        />
      )
    },
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (row: ResourceGroupSummary) => (
        <span className="font-medium text-zinc-200">{row.name}</span>
      )
    },
    {
      key: 'description',
      label: 'Description',
      sortable: true,
      className: 'max-w-xs',
      render: (row: ResourceGroupSummary) => (
        <span
          className="block truncate text-zinc-400 max-w-[240px]"
          title={row.description || undefined}
        >
          {row.description || '—'}
        </span>
      )
    },
    {
      key: 'projects',
      label: 'Projects',
      sortable: true,
      render: (row: ResourceGroupSummary) => (
        <span className="text-zinc-400">
          {row.usedProjectCount}/{row.totalProjectCount}
        </span>
      )
    },
    {
      key: 'tokens',
      label: 'Tokens',
      sortable: true,
      render: (row: ResourceGroupSummary) => (
        <span className="text-zinc-400">{row.tokenEstimate.toLocaleString()}</span>
      )
    },
    {
      key: 'updated',
      label: 'Last updated',
      sortable: true,
      render: (row: ResourceGroupSummary) => (
        <span className="text-zinc-500">{formatDate(row.lastUpdatedAt)}</span>
      )
    },
    mandatoryToggleColumn,
    installColumn,
    deleteColumn
  ]

  const columns = enhanced ? enhancedColumns : legacyColumns

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 py-3 border-b border-zinc-800">
        <h2 className="text-lg font-medium">{title}</h2>
        {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
      </header>
      <ResourceListToolbar
        search={search}
        onSearchChange={setSearch}
        filter={filter}
        onFilterChange={setFilter}
        onAdd={onAdd}
        categoryFilter={enhanced ? categoryFilter : undefined}
        onCategoryFilterChange={enhanced ? setCategoryFilter : undefined}
        categories={enhanced ? categories : undefined}
      />
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">Loading…</div>
      ) : (
        <ResourceTable
          columns={columns}
          rows={filtered}
          rowKey={(r) => r.name}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          onRowClick={enhanced ? (row) => onEdit(row.name) : undefined}
        />
      )}
    </div>
  )
}

export function ResourceSubViewHeader({
  title,
  onBack
}: {
  title: string
  onBack: () => void
}) {
  return (
    <header className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
      <button
        type="button"
        onClick={onBack}
        className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400"
        aria-label="Back"
      >
        <ArrowLeft size={16} />
      </button>
      <h2 className="text-lg font-medium">{title}</h2>
    </header>
  )
}
