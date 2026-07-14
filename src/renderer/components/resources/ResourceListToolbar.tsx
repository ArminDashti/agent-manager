import { CategoryFilterDropdown } from './CategoryFilterDropdown'
import { ProjectFilterDropdown } from './ProjectFilterDropdown'
import type { ProjectInfo } from '@shared/types'

export type ResourceFilter = 'all' | 'single-project'

interface ResourceListToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  filter: ResourceFilter
  onFilterChange: (value: ResourceFilter) => void
  onAdd?: () => void
  addLabel?: string
  selectedCategories?: Set<string>
  onCategoryFilterChange?: (selected: Set<string>) => void
  categories?: string[]
  projects?: ProjectInfo[]
  selectedProjectId?: string
  onProjectFilterChange?: (projectId: string) => void
  showProjectFilter?: boolean
}

export function ResourceListToolbar({
  search,
  onSearchChange,
  filter,
  onFilterChange,
  onAdd,
  addLabel = 'Add',
  selectedCategories,
  onCategoryFilterChange,
  categories = [],
  projects = [],
  selectedProjectId,
  onProjectFilterChange,
  showProjectFilter = false
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
      {showProjectFilter && onProjectFilterChange && selectedProjectId && (
        <ProjectFilterDropdown
          projects={projects}
          selectedProjectId={selectedProjectId}
          onChange={onProjectFilterChange}
        />
      )}
      {onCategoryFilterChange && selectedCategories && (
        <CategoryFilterDropdown
          categories={categories}
          selected={selectedCategories}
          onChange={onCategoryFilterChange}
        />
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
