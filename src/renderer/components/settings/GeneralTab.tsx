import { useEffect, useState } from 'react'
import type { AppSettings } from '@shared/types'
import { useAppStore } from '@renderer/stores/appStore'
import { showMessage } from '@renderer/stores/messageStore'

interface GeneralTabProps {
  settings: AppSettings
  onChange: (settings: AppSettings) => void
}

export function GeneralTab({ settings, onChange }: GeneralTabProps) {
  const { loadSettings } = useAppStore()
  const [pat, setPat] = useState('')
  const [hubBase, setHubBase] = useState(settings.hub.baseUrl)
  const [syncEnabled, setSyncEnabled] = useState(settings.sync?.enabled ?? true)
  const [syncInterval, setSyncInterval] = useState(settings.sync?.intervalMinutes ?? 30)

  useEffect(() => {
    void window.agentManager.getPat().then(setPat)
  }, [])

  useEffect(() => {
    setHubBase(settings.hub.baseUrl)
    setSyncEnabled(settings.sync?.enabled ?? true)
    setSyncInterval(settings.sync?.intervalMinutes ?? 30)
  }, [settings])

  const savePat = async () => {
    await window.agentManager.setPat(pat)
    await showMessage({ message: 'PAT saved', type: 'success' })
  }

  const saveGeneral = async () => {
    const next: AppSettings = {
      ...settings,
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
        <button type="button" onClick={() => void savePat()} className="px-4 py-2 text-sm bg-zinc-800 rounded">
          Save PAT
        </button>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-zinc-400 uppercase">Hub</h3>
        <input
          value={hubBase}
          onChange={(e) => setHubBase(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
        />
        <button type="button" onClick={() => void fetchHub()} className="px-4 py-2 text-sm bg-zinc-800 rounded">
          Fetch Hub
        </button>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-zinc-400 uppercase">GitHub Sync</h3>
        <p className="text-xs text-zinc-500">
          Periodically pull from and push to the Git backup repository.
        </p>
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={syncEnabled}
            onChange={(e) => setSyncEnabled(e.target.checked)}
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
            className="w-24 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
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
