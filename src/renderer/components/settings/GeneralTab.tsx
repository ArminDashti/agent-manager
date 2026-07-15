import { useEffect, useMemo, useState } from 'react'
import type { AppSettings } from '@shared/types'
import { isValidGithubUrl } from '@shared/utils.browser'
import { useAppStore } from '@renderer/stores/appStore'
import { showMessage } from '@renderer/stores/messageStore'
import { cn } from '@renderer/lib/utils'

interface GeneralTabProps {
  settings: AppSettings
  onChange: (settings: AppSettings) => void
}

export function GeneralTab({ settings, onChange }: GeneralTabProps) {
  const { loadSettings } = useAppStore()
  const [pat, setPat] = useState(settings.github?.pat ?? '')
  const [hubBase, setHubBase] = useState(settings.hub.baseUrl)
  const [runOnLogin, setRunOnLogin] = useState(settings.startup?.runOnLogin ?? false)
  const [syncEnabled, setSyncEnabled] = useState(settings.sync?.enabled ?? true)
  const [syncInterval, setSyncInterval] = useState(settings.sync?.intervalMinutes ?? 30)

  useEffect(() => {
    setPat(settings.github?.pat ?? '')
    setHubBase(settings.hub.baseUrl)
    setRunOnLogin(settings.startup?.runOnLogin ?? false)
    setSyncEnabled(settings.sync?.enabled ?? true)
    setSyncInterval(settings.sync?.intervalMinutes ?? 30)
  }, [settings])

  const patValid = settings.github?.patValid ?? false
  const hubUrlValid = isValidGithubUrl(hubBase)

  const saveGeneral = async () => {
    const confirmed = await showMessage({
      message: 'Save general settings?',
      confirm: true
    })
    if (!confirmed) return

    const validation = pat.trim() ? await window.agentManager.validatePat(pat) : { valid: false }

    const next: AppSettings = {
      ...settings,
      github: {
        pat: pat.trim(),
        patValid: validation.valid,
        patValidatedAt: validation.valid ? new Date().toISOString() : null
      },
      startup: { runOnLogin },
      hub: {
        ...settings.hub,
        baseUrl: hubBase,
        catalogUrl: `${hubBase.replace(/\/$/, '')}/hub/manifest.json`
      },
      sync: {
        enabled: syncEnabled,
        intervalMinutes: syncInterval,
        lastSyncAt: settings.sync?.lastSyncAt ?? null
      }
    }
    await window.agentManager.saveSettings(next)
    onChange(next)
    await loadSettings()
    await showMessage({ message: 'Settings saved', type: 'success' })
  }

  const fetchHub = async () => {
    try {
      await window.agentManager.hubFetchCatalog()
      await showMessage({ message: 'Hub catalog fetched', type: 'success' })
    } catch (e) {
      await showMessage({
        message: e instanceof Error ? e.message : 'Hub fetch failed',
        type: 'error'
      })
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h3 className="text-sm font-medium text-zinc-400 uppercase">GitHub PAT</h3>
        <input
          type="password"
          value={pat}
          onChange={(e) => setPat(e.target.value)}
          placeholder="ghp_…"
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
        />
        {patValid ? (
          <p className="text-xs text-emerald-500">PAT validated</p>
        ) : (
          <p className="text-xs text-zinc-500">Save to validate your PAT</p>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-zinc-400 uppercase">Hub</h3>
        <input
          value={hubBase}
          onChange={(e) => setHubBase(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => void fetchHub()}
          disabled={!hubUrlValid}
          className="px-4 py-2 text-sm bg-zinc-800 rounded disabled:opacity-40"
        >
          Fetch Hub
        </button>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-zinc-400 uppercase">Startup</h3>
        <p className="text-xs text-zinc-500">
          Launch Janus automatically when you sign in to Windows.
        </p>
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={runOnLogin}
            onChange={(e) => setRunOnLogin(e.target.checked)}
          />
          Run Janus when Windows starts
        </label>
      </section>

      <section
        className={cn(
          'space-y-3 rounded-lg border border-zinc-800 p-4',
          !patValid && 'opacity-50 pointer-events-none'
        )}
      >
        <h3 className="text-sm font-medium text-zinc-400 uppercase">GitHub Sync</h3>
        <p className="text-xs text-zinc-500">
          Periodically pull from and push to the Git backup repository.
        </p>
        {!patValid && (
          <p className="text-xs text-amber-500">Save a valid GitHub PAT to enable sync</p>
        )}
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={syncEnabled}
            onChange={(e) => setSyncEnabled(e.target.checked)}
            disabled={!patValid}
          />
          Enable automatic sync
        </label>
        <div className="flex items-center gap-2">
          <label className="text-sm text-zinc-400">Interval (minutes)</label>
          <input
            type="number"
            min={1}
            value={syncInterval}
            onChange={(e) => setSyncInterval(Number(e.target.value))}
            disabled={!patValid}
            className="w-24 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm disabled:opacity-40"
          />
        </div>
        {settings.sync?.lastSyncAt && (
          <p className="text-xs text-zinc-500">
            Last sync: {new Date(settings.sync.lastSyncAt).toLocaleString()}
          </p>
        )}
      </section>

      <button type="button" onClick={() => void saveGeneral()} className="px-4 py-2 text-sm bg-emerald-700 rounded">
        Save general settings
      </button>
    </div>
  )
}
