import type { UiFilterState } from '@shared/types'
import type { ResourceFilter } from '@renderer/components/resources/ResourceListToolbar'
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
  filter: 'all',
  selectedProjectId: ALL_PROJECTS_KEY,
  selectedCategories: [],
  sortKey: 'name',
  sortDir: 'asc'
}

export function mergeUiFilter(partial?: Partial<UiFilterState>): UiFilterState {
  return {
    ...DEFAULT_UI_FILTER,
    ...partial,
    selectedCategories: partial?.selectedCategories ?? DEFAULT_UI_FILTER.selectedCategories
  }
}

export function toResourceFilter(value: string): ResourceFilter {
  return value === 'single-project' ? 'single-project' : 'all'
}
