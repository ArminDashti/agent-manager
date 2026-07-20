import { useEffect, useMemo, useState } from 'react'
import { Folder } from 'lucide-react'
import type { AppSettings, PlatformConfig, PlatformId } from '@shared/types'
import {
  DEFAULT_PLATFORM_ROOTS,
  PLATFORM_IDS,
  PLATFORM_LABELS
} from '@shared/types'
import { PlatformLogo } from '@renderer/components/PlatformLogo'
import { Toggle } from '@renderer/components/Toggle'
import { useAppStore } from '@renderer/stores/appStore'
import { showMessage } from '@renderer/stores/messageStore'
import { cn } from '@renderer/lib/utils'

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
        enabled: id === 'cursor',
        rootPath: DEFAULT_PLATFORM_ROOTS[id]
      }
    )
  })
}

function PlatformCard({
  platform,
  onUpdate,
  onBrowse
}: {
  platform: PlatformConfig
  onUpdate: (patch: Partial<PlatformConfig>) => void
  onBrowse: () => void
}) {
  const pathMissing = platform.enabled && !platform.rootPath.trim()

  return (
    <div
      className={cn(
        'flex flex-col gap-3 p-4 rounded-xl border transition-colors',
        platform.enabled
          ? 'bg-zinc-900/70 border-zinc-700'
          : 'bg-zinc-950/50 border-zinc-800 opacity-80'
      )}
    >
      <div className="flex items-center gap-3">
        <PlatformLogo platformId={platform.id} size={36} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-100">
              {PLATFORM_LABELS[platform.id]}
            </span>
            {platform.enabled && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Enabled" />
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5 font-mono truncate" title={platform.rootPath}>
            {platform.rootPath || 'No path set'}
          </p>
        </div>
        <Toggle
          checked={platform.enabled}
          onChange={(enabled) => onUpdate({ enabled })}
          title={platform.enabled ? 'Disable platform' : 'Enable platform'}
        />
        <span className="text-xs text-zinc-500 w-6 text-right shrink-0">
          {platform.enabled ? 'On' : 'Off'}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Folder size={14} strokeWidth={1.75} className="text-zinc-500 shrink-0" />
        <input
          value={platform.rootPath}
          onChange={(e) => onUpdate({ rootPath: e.target.value })}
          placeholder="Platform root directory"
          className="flex-1 min-w-0 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-xs font-mono"
        />
        <button
          type="button"
          onClick={onBrowse}
          className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 rounded shrink-0"
        >
          Browse
        </button>
      </div>

      {pathMissing && (
        <p className="text-xs text-amber-500/90">Set a root path while this platform is enabled.</p>
      )}
    </div>
  )
}

export function PlatformsTab({ settings, onChange }: PlatformsTabProps) {
  const { loadSettings } = useAppStore()
  const platforms = useMemo(() => mergePlatforms(settings), [settings])
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(platforms))

  useEffect(() => {
    setSavedSnapshot(JSON.stringify(mergePlatforms(settings)))
  }, [settings])

  const dirty = JSON.stringify(platforms) !== savedSnapshot

  const enabledPlatforms = platforms.filter((p) => p.enabled)
  const availablePlatforms = platforms.filter((p) => !p.enabled)

  const updatePlatform = (id: PlatformId, patch: Partial<PlatformConfig>) => {
    const nextPlatforms = platforms.map((p) => (p.id === id ? { ...p, ...patch } : p))
    onChange({ ...settings, platforms: nextPlatforms })
  }

  const browseDir = async (id: PlatformId) => {
    const dir = await window.agentManager.openDirectory()
    if (dir) updatePlatform(id, { rootPath: dir })
  }

  const removeFromProjects = async () => {
    const disabled = platforms.filter((p) => !p.enabled).map((p) => p.id)
    if (disabled.length === 0) {
      await showMessage({ message: 'No disabled platforms to remove.', type: 'info' })
      return
    }

    const labels = disabled.map((id) => PLATFORM_LABELS[id]).join(', ')
    const confirmed = await showMessage({
      message: `Remove platform folders from all imported projects for: ${labels}?`,
      confirm: true
    })
    if (!confirmed) return

    const result = await window.agentManager.purgePlatformsFromProjects(disabled)
    const msg =
      result.errors.length > 0
        ? `Removed ${result.foldersRemoved.length} folder(s) from ${result.projectsAffected} project(s). ${result.errors.length} error(s).`
        : `Removed ${result.foldersRemoved.length} folder(s) from ${result.projectsAffected} project(s).`
    await showMessage({
      message: msg,
      type: result.errors.length > 0 ? 'error' : 'success'
    })
  }

  const savePlatforms = async () => {
    const confirmed = await showMessage({
      message: 'Save platform settings?',
      confirm: true
    })
    if (!confirmed) return

    const next = { ...settings, platforms }
    await window.agentManager.saveSettings(next)
    onChange(next)
    setSavedSnapshot(JSON.stringify(platforms))
    await loadSettings()
    await showMessage({ message: 'Platform settings saved', type: 'success' })
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-12rem)]">
      <div className="flex-1 space-y-8 pb-24">
        <p className="text-xs text-zinc-500">
          Configure where Janus reads each AI platform&apos;s config. Enable only the platforms you use.
        </p>

        <section className="space-y-3">
          <h3 className="text-sm font-medium text-zinc-300">
            Enabled platforms
            <span className="ml-2 text-xs font-normal text-zinc-500">({enabledPlatforms.length})</span>
          </h3>
          {enabledPlatforms.length === 0 ? (
            <p className="text-sm text-zinc-500 py-4">No platforms enabled. Turn on a platform below.</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {enabledPlatforms.map((platform) => (
                <PlatformCard
                  key={platform.id}
                  platform={platform}
                  onUpdate={(patch) => updatePlatform(platform.id, patch)}
                  onBrowse={() => void browseDir(platform.id)}
                />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-medium text-zinc-300">
            Available platforms
            <span className="ml-2 text-xs font-normal text-zinc-500">({availablePlatforms.length})</span>
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {availablePlatforms.map((platform) => (
              <PlatformCard
                key={platform.id}
                platform={platform}
                onUpdate={(patch) => updatePlatform(platform.id, patch)}
                onBrowse={() => void browseDir(platform.id)}
              />
            ))}
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 -mx-6 px-6 py-4 bg-zinc-950/95 border-t border-zinc-800 flex items-center justify-between gap-3">
        <span className={cn('text-xs', dirty ? 'text-amber-400' : 'text-zinc-500')}>
          {dirty ? 'Unsaved changes' : 'All changes saved'}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void removeFromProjects()}
            className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 rounded"
          >
            Remove from projects
          </button>
          <button
            type="button"
            onClick={() => void savePlatforms()}
            disabled={!dirty}
            className="px-4 py-2 text-sm bg-emerald-700 hover:bg-emerald-600 rounded disabled:opacity-40"
          >
            Save platforms
          </button>
        </div>
      </div>
    </div>
  )
}
