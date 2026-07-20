import type { UiFilterState, ProjectUsageFilter } from '@shared/types'
import { ALL_PROJECTS_KEY } from '@renderer/components/resources/ProjectFilterDropdown'

export type ListableResourceType = 'skill' | 'rule' | 'hook' | 'subAgent' | 'tool'

const FILTER_KEYS: Record<ListableResourceType, string> = {
  skill: 'skills',
  rule: 'rules',
  hook: 'hooks',
  subAgent: 'subagents',
  tool: 'tools'
}

export function filterStorageKey(resourceType: ListableResourceType): string {
  return FILTER_KEYS[resourceType]
}

export const DEFAULT_UI_FILTER: UiFilterState = {
  search: '',
  projectUsageFilter: 'multiple',
  selectedProjectId: ALL_PROJECTS_KEY,
  selectedCategories: [],
  sortKey: 'name',
  sortDir: 'asc'
}

type LegacyUiFilter = Partial<UiFilterState> & {
  filter?: 'all' | 'single-project'
  hideSingleProject?: boolean
}

export function mergeUiFilter(partial?: Partial<UiFilterState> | LegacyUiFilter): UiFilterState {
  const legacy = (partial ?? {}) as LegacyUiFilter
  const { filter: legacyFilter, hideSingleProject, projectUsageFilter, ...rest } = legacy

  let resolvedFilter: ProjectUsageFilter = DEFAULT_UI_FILTER.projectUsageFilter
  if (projectUsageFilter === 'single' || projectUsageFilter === 'multiple' || projectUsageFilter === 'both') {
    resolvedFilter = projectUsageFilter
  } else if (typeof hideSingleProject === 'boolean') {
    resolvedFilter = hideSingleProject ? 'multiple' : 'both'
  } else if (legacyFilter === 'single-project') {
    resolvedFilter = 'single'
  }

  return {
    ...DEFAULT_UI_FILTER,
    ...rest,
    projectUsageFilter: resolvedFilter,
    selectedCategories: rest.selectedCategories ?? DEFAULT_UI_FILTER.selectedCategories
  }
}

export function matchesProjectUsageFilter(
  usedProjectCount: number,
  filter: ProjectUsageFilter
): boolean {
  switch (filter) {
    case 'single':
      return usedProjectCount === 1
    case 'multiple':
      return usedProjectCount > 1
    case 'both':
      return true
  }
}
