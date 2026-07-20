import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowDownToLine, Wand2, Trash } from 'lucide-react'
import type { ResourceGroupSummary, ResourceType, UiFilterState } from '@shared/types'
import { formatDateWithRelative } from '@shared/utils.browser'
import { ResourceTable } from './ResourceTable'
import { ResourceListToolbar } from './ResourceListToolbar'
import { OpenRouterRefactorModal } from './OpenRouterRefactorModal'
import { ALL_PROJECTS_KEY } from './ProjectFilterDropdown'
import { UNCATEGORIZED_KEY } from './CategoryFilterDropdown'
import { showMessage } from '@renderer/stores/messageStore'
import { useAppStore } from '@renderer/stores/appStore'
import { matchesProjectUsageFilter } from '@renderer/lib/filter-utils'

type ListableResourceType = Exclude<ResourceType, 'mcp'>

interface ResourceListViewProps {
  title: string
  subtitle?: string
  resourceType: ListableResourceType
  filterState: UiFilterState
  onFilterChange: (patch: Partial<UiFilterState>) => void
  onAssign: (name: string) => void
  onEdit: (name: string) => void
  onRefresh?: () => void
  onAdd?: () => void
}

function isEnhancedGrid(
  resourceType: ListableResourceType
): resourceType is 'skill' | 'rule' | 'hook' | 'subAgent' {
  return (
    resourceType === 'skill' ||
    resourceType === 'rule' ||
    resourceType === 'hook' ||
    resourceType === 'subAgent'
  )
}

function hasCategoryColumn(
  resourceType: ListableResourceType
): resourceType is 'skill' | 'rule' {
  return resourceType === 'skill' || resourceType === 'rule'
}

function isRenamable(
  resourceType: ListableResourceType
): resourceType is 'skill' | 'rule' | 'hook' | 'subAgent' {
  return isEnhancedGrid(resourceType)
}

export function ResourceListView({
  title,
  subtitle,
  resourceType,
  filterState,
  onFilterChange,
  onAssign,
  onEdit,
  onRefresh,
  onAdd
}: ResourceListViewProps) {
  const { settings } = useAppStore()
  const [summaries, setSummaries] = useState<ResourceGroupSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [refactorTarget, setRefactorTarget] = useState<string | null>(null)
  const summariesRef = useRef(summaries)
  summariesRef.current = summaries

  const { search, projectUsageFilter, selectedProjectId, selectedCategories, sortKey, sortDir } =
    filterState
  const selectedCategorySet = useMemo(
    () => new Set(selectedCategories),
    [selectedCategories]
  )

  const enhanced = isEnhancedGrid(resourceType)
  const showCategory = hasCategoryColumn(resourceType)
  const renamable = isRenamable(resourceType)
  const refactorable = isEnhancedGrid(resourceType)

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    const soft = opts?.soft === true && summariesRef.current.length > 0
    if (!soft) setLoading(true)
    try {
      const stats = await window.agentManager.getResourceStats(resourceType)
      setSummaries(stats)
    } finally {
      if (!soft) setLoading(false)
    }
  }, [resourceType])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const handler = () => void load({ soft: true })
    window.addEventListener('scan-changed', handler)
    return () => window.removeEventListener('scan-changed', handler)
  }, [load])

  const categories = useMemo(() => {
    if (!showCategory) return []
    const cats = new Set<string>()
    for (const row of summaries) {
      if (row.category.trim()) cats.add(row.category.trim())
    }
    return [...cats].sort((a, b) => a.localeCompare(b))
  }, [summaries, showCategory])

  const projects = useMemo(
    () => settings?.projectRoots.flatMap((r) => r.projects).sort((a, b) => a.name.localeCompare(b.name)) ?? [],
    [settings]
  )

  const filtered = useMemo(() => {
    let rows = summaries
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      rows = rows.filter((r) => {
        const haystack = [r.name, r.description, r.category].join(' ').toLowerCase()
        return haystack.includes(q)
      })
    }
    if (enhanced && selectedProjectId !== ALL_PROJECTS_KEY) {
      rows = rows.filter((r) => r.assignedProjectIds.includes(selectedProjectId))
    }
    if (projectUsageFilter !== 'both') {
      rows = rows.filter((r) => matchesProjectUsageFilter(r.usedProjectCount, projectUsageFilter))
    }
    if (showCategory && selectedCategorySet.size > 0) {
      rows = rows.filter((r) => {
        const cat = r.category.trim()
        if (!cat && selectedCategorySet.has(UNCATEGORIZED_KEY)) return true
        if (cat && selectedCategorySet.has(cat)) return true
        return false
      })
    }
    const sorted = [...rows].sort((a, b) => {
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
    return sorted
  }, [
    summaries,
    search,
    projectUsageFilter,
    selectedCategorySet,
    selectedProjectId,
    sortKey,
    sortDir,
    showCategory,
    enhanced,
    resourceType
  ])

  const handleSort = (key: string) => {
    if (sortKey === key) {
      onFilterChange({ sortDir: sortDir === 'asc' ? 'desc' : 'asc' })
    } else {
      onFilterChange({ sortKey: key, sortDir: 'asc' })
    }
  }

  const handleCategoryChange = async (name: string, category: string) => {
    if (!showCategory) return
    await window.agentManager.setResourceCategory(resourceType, name, category)
    await load()
    onRefresh?.()
  }

  const handleRename = async (oldName: string, newName: string) => {
    if (!renamable) return
    try {
      await window.agentManager.renameResource(resourceType, oldName, newName)
      await load()
      onRefresh?.()
    } catch (e) {
      await showMessage({
        message: e instanceof Error ? e.message : 'Rename failed',
        type: 'error'
      })
    }
  }

  const handleDelete = async (name: string) => {
    const confirmed = await showMessage({
      message: `Delete "${name}" from all locations? Items are kept under .trash.`,
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

  const actionsColumn = {
    key: 'actions',
    label: '',
    className: 'w-28',
    render: (row: ResourceGroupSummary) => (
      <div className="flex items-center gap-0.5 whitespace-nowrap">
        <button
          type="button"
          onClick={(e) => {
            stopProp(e)
            onAssign(row.name)
          }}
          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200"
          title="Install"
        >
          <ArrowDownToLine size={15} strokeWidth={1.75} />
        </button>
        {refactorable && (
          <button
            type="button"
            onClick={(e) => {
              stopProp(e)
              setRefactorTarget(row.name)
            }}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200"
            title="Refactor by OpenRouter"
          >
            <Wand2 size={15} strokeWidth={1.75} />
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            stopProp(e)
            void handleDelete(row.name)
          }}
          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-red-400"
          title="Delete"
        >
          <Trash size={15} strokeWidth={1.75} />
        </button>
      </div>
    )
  }

  const categoryColumn = {
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
  }

  const nameColumn = {
    key: 'name',
    label: 'Name',
    sortable: true,
    className: 'min-w-[16rem] w-[22rem]',
    render: (row: ResourceGroupSummary) =>
      renamable ? (
        <input
          type="text"
          defaultValue={row.name}
          key={`${row.name}-resource-name`}
          onClick={stopProp}
          onBlur={(e) => {
            const next = e.target.value.trim()
            if (next && next !== row.name) void handleRename(row.name, next)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          className="w-full min-w-[14rem] bg-transparent border border-transparent hover:border-zinc-700 focus:border-zinc-600 rounded px-1 py-0.5 text-sm font-medium text-zinc-200"
        />
      ) : (
        <span className="font-medium text-zinc-200">{row.name}</span>
      )
  }

  const enhancedBaseColumns = [
    nameColumn,
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
        <span className="text-zinc-500">{formatDateWithRelative(row.lastUpdatedAt)}</span>
      )
    },
    actionsColumn
  ]

  const legacyColumns = [
    nameColumn,
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
        <span className="text-zinc-500">{formatDateWithRelative(row.lastUpdatedAt)}</span>
      )
    },
    actionsColumn
  ]

  const columns = enhanced
    ? showCategory
      ? [categoryColumn, ...enhancedBaseColumns]
      : enhancedBaseColumns
    : legacyColumns

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="px-4 py-3 border-b border-zinc-800">
        <h2 className="text-lg font-medium">{title}</h2>
        {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
      </header>
      <ResourceListToolbar
        search={search}
        onSearchChange={(value) => onFilterChange({ search: value })}
        projectUsageFilter={projectUsageFilter}
        onProjectUsageFilterChange={(value) => onFilterChange({ projectUsageFilter: value })}
        onAdd={onAdd}
        selectedCategories={showCategory ? selectedCategorySet : undefined}
        onCategoryFilterChange={
          showCategory
            ? (selected) =>
                onFilterChange({ selectedCategories: [...selected] })
            : undefined
        }
        categories={showCategory ? categories : undefined}
        showProjectFilter={enhanced}
        projects={projects}
        selectedProjectId={selectedProjectId}
        onProjectFilterChange={(value) => onFilterChange({ selectedProjectId: value })}
      />
      {loading && summaries.length === 0 ? (
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
      {refactorTarget && refactorable && (
        <OpenRouterRefactorModal
          resourceType={resourceType}
          resourceName={refactorTarget}
          onClose={() => setRefactorTarget(null)}
        />
      )}
    </div>
  )
}

export function ResourceSubViewHeader({
  title,
  onBack,
  actions
}: {
  title: string
  onBack: () => void
  actions?: React.ReactNode
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
      <h2 className="text-lg font-medium flex-1">{title}</h2>
      {actions}
    </header>
  )
}
