import type { AppSettings, PlatformConfig, PlatformId } from '@shared/types'
import { DEFAULT_PLATFORM_ROOTS, PLATFORM_IDS } from '@shared/types'
import { expandHome } from '@shared/utils'

export function createDefaultSettings(): AppSettings {
  const platforms: PlatformConfig[] = PLATFORM_IDS.map((id) => ({
    id,
    enabled: id === 'cursor',
    rootPath: expandHome(DEFAULT_PLATFORM_ROOTS[id])
  }))

  return {
    window: { maximized: true },
    startup: { runOnLogin: false },
    dataPath: './data',
    platforms,
    projectRoots: [],
    github: {
      pat: '',
      patValid: false,
      patValidatedAt: null
    },
    openRouter: {
      apiKey: '',
      model: 'openai/gpt-4o-mini'
    },
    repoBank: {
      url: '',
      localClonePath: './data/repo-bank',
      lastFetchAt: null,
      lastPushAt: null
    },
    hub: {
      baseUrl: 'https://github.com/armindashti/janus-hub',
      catalogUrl: 'https://github.com/armindashti/janus-hub/hub/manifest.json',
      lastFetchAt: null
    },
    sync: {
      enabled: true,
      intervalMinutes: 30,
      lastSyncAt: null
    },
    assignments: {
      skills: {},
      rules: {},
      mcps: {},
      hooks: {},
      subAgents: {},
      tools: {}
    },
    mandatoryForAllProjects: {
      skills: {},
      rules: {},
      hooks: {},
      subAgents: {},
      tools: {}
    },
    resourceCategories: {
      skills: {},
      rules: {}
    },
    uiFilters: {}
  }
}

export function getPlatformConfig(
  settings: AppSettings,
  platformId: PlatformId
): PlatformConfig | undefined {
  return settings.platforms.find((p) => p.id === platformId)
}
