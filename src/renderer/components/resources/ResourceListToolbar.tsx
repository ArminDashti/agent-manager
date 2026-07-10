export type ResourceFilter = 'all' | 'single-project'

interface ResourceListToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  filter: ResourceFilter
  onFilterChange: (value: ResourceFilter) => void
  onAdd?: () => void
  addLabel?: string
  categoryFilter?: string
  onCategoryFilterChange?: (value: string) => void
  categories?: string[]
}

export function ResourceListToolbar({
  search,
  onSearchChange,
  filter,
  onFilterChange,
  onAdd,
  addLabel = 'Add',
  categoryFilter,
  onCategoryFilterChange,
  categories = []
}: ResourceListToolbarProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
      <input
        type="search"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search…"
        className="flex-1 max-w-xs bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm"
      />
      {onCategoryFilterChange && (
        <select
          value={categoryFilter ?? 'all'}
          onChange={(e) => onCategoryFilterChange(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-300"
        >
          <option value="all">All categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
          <option value="__uncategorized__">Uncategorized</option>
        </select>
      )}
      <select
        value={filter}
        onChange={(e) => onFilterChange(e.target.value as ResourceFilter)}
        className="bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-300"
      >
        <option value="all">All</option>
        <option value="single-project">Using for only one project</option>
      </select>
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 rounded"
        >
          {addLabel}
        </button>
      )}
    </div>
  )
}
