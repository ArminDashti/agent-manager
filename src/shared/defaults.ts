import type { AppSettings, PlatformConfig, PlatformId } from '@shared/types'
import { DEFAULT_PLATFORM_ROOTS, PLATFORM_IDS } from '@shared/types'
import { expandHome } from '@shared/utils'

export function createDefaultSettings(): AppSettings {
  const platforms: PlatformConfig[] = PLATFORM_IDS.map((id) => ({
    id,
    enabled: id === 'cursor' || id === 'cline',
    rootPath: expandHome(DEFAULT_PLATFORM_ROOTS[id])
  }))

  return {
    window: { maximized: true },
    dataPath: './data',
    platforms,
    projectRoots: [],
    repoBank: {
      url: '',
      localClonePath: './data/repo-bank',
      lastFetchAt: null,
      lastPushAt: null
    },
    hub: {
      baseUrl: 'https://armindashti.github.com/agent-manager-hub',
      catalogUrl: 'https://armindashti.github.com/agent-manager-hub/hub/manifest.json',
      lastFetchAt: null
    },
    assignments: {
      skills: {},
      rules: {},
      mcps: {},
      hooks: {},
      subAgents: {},
      tools: {}
    }
  }
}

export function getPlatformConfig(
  settings: AppSettings,
  platformId: PlatformId
): PlatformConfig | undefined {
  return settings.platforms.find((p) => p.id === platformId)
}
