import { CategoryFilterDropdown } from './CategoryFilterDropdown'
import { ProjectFilterDropdown } from './ProjectFilterDropdown'
import { ProjectUsageFilterGroup } from './ProjectUsageFilter'
import type { ProjectInfo, ProjectUsageFilter } from '@shared/types'

interface ResourceListToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  projectUsageFilter: ProjectUsageFilter
  onProjectUsageFilterChange: (value: ProjectUsageFilter) => void
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
  projectUsageFilter,
  onProjectUsageFilterChange,
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
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800 flex-nowrap overflow-visible">
      <input
        type="search"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search…"
        className="w-72 min-w-[18rem] shrink-0 bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm"
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
      <ProjectUsageFilterGroup
        value={projectUsageFilter}
        onChange={onProjectUsageFilterChange}
      />
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="ml-auto shrink-0 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 rounded whitespace-nowrap"
        >
          {addLabel}
        </button>
      )}
    </div>
  )
}
