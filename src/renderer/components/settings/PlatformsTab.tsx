import { useMemo } from 'react'
import type { AppSettings, PlatformConfig, PlatformId } from '@shared/types'
import {
  DEFAULT_PLATFORM_ROOTS,
  PLATFORM_IDS,
  PLATFORM_LABELS
} from '@shared/types'
import { PlatformLogo } from '@renderer/components/PlatformLogo'
import { useAppStore } from '@renderer/stores/appStore'
import { showMessage } from '@renderer/stores/messageStore'

interface PlatformsTabProps {
  settings: AppSettings
  onChange: (settings: AppSettings) => void
}

function mergePlatforms(settings: AppSettings): PlatformConfig[] {
  return PLATFORM_IDS.map((id) => {
    const existing = settings.platforms.find((p) => p.id === id)
    return (
      existing ?? {
        id,
        enabled: id === 'cursor' || id === 'cline',
        rootPath: DEFAULT_PLATFORM_ROOTS[id]
      }
    )
  })
}

export function PlatformsTab({ settings, onChange }: PlatformsTabProps) {
  const { loadSettings } = useAppStore()
  const platforms = useMemo(() => mergePlatforms(settings), [settings])

  const updatePlatform = (id: PlatformId, patch: Partial<PlatformConfig>) => {
    const nextPlatforms = platforms.map((p) => (p.id === id ? { ...p, ...patch } : p))
    onChange({ ...settings, platforms: nextPlatforms })
  }

  const browseDir = async (id: PlatformId) => {
    const dir = await window.agentManager.openDirectory()
    if (dir) updatePlatform(id, { rootPath: dir })
  }

  const savePlatforms = async () => {
    const next = { ...settings, platforms }
    await window.agentManager.saveSettings(next)
    onChange(next)
    await loadSettings()
    await showMessage({ message: 'Platform settings saved', type: 'success' })
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-500">
        Configure the root directory for each AI platform. Sorted alphabetically.
      </p>
      <div className="space-y-3">
        {platforms.map((platform) => (
          <div
            key={platform.id}
            className="flex items-center gap-3 p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg"
          >
            <PlatformLogo platformId={platform.id} size={28} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-zinc-200">
                  {PLATFORM_LABELS[platform.id]}
                </span>
                <label className="flex items-center gap-1 text-xs text-zinc-500">
                  <input
                    type="checkbox"
                    checked={platform.enabled}
                    onChange={(e) => updatePlatform(platform.id, { enabled: e.target.checked })}
                  />
                  Enabled
                </label>
              </div>
              <input
                value={platform.rootPath}
                onChange={(e) => updatePlatform(platform.id, { rootPath: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs font-mono"
              />
            </div>
            <button
              type="button"
              onClick={() => void browseDir(platform.id)}
              className="px-3 py-1.5 text-xs bg-zinc-800 rounded shrink-0"
            >
              Browse
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => void savePlatforms()} className="px-4 py-2 text-sm bg-emerald-700 rounded">
        Save platforms
      </button>
    </div>
  )
}
