import type { UiFilterState } from '@shared/types'
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
  hideSingleProject: true,
  selectedProjectId: ALL_PROJECTS_KEY,
  selectedCategories: [],
  sortKey: 'name',
  sortDir: 'asc'
}

type LegacyUiFilter = Partial<UiFilterState> & {
  filter?: 'all' | 'single-project'
}

export function mergeUiFilter(partial?: Partial<UiFilterState> | LegacyUiFilter): UiFilterState {
  const legacy = (partial ?? {}) as LegacyUiFilter
  const { filter: legacyFilter, hideSingleProject: explicitHide, ...rest } = legacy

  let hideSingleProject = DEFAULT_UI_FILTER.hideSingleProject
  if (typeof explicitHide === 'boolean') {
    hideSingleProject = explicitHide
  } else if (legacyFilter === 'single-project') {
    // Old "show only single-project" ⇒ user wants to see singles ⇒ do not hide them
    hideSingleProject = false
  }

  return {
    ...DEFAULT_UI_FILTER,
    ...rest,
    hideSingleProject,
    selectedCategories: rest.selectedCategories ?? DEFAULT_UI_FILTER.selectedCategories
  }
}
