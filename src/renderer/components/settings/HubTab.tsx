import { useEffect, useState } from 'react'
import type { AppSettings } from '@shared/types'
import { isValidGithubUrl } from '@shared/utils.browser'
import { useAppStore } from '@renderer/stores/appStore'
import { showMessage } from '@renderer/stores/messageStore'

interface HubTabProps {
  settings: AppSettings
  onChange: (settings: AppSettings) => void
}

export function HubTab({ settings, onChange }: HubTabProps) {
  const { loadSettings } = useAppStore()
  const [hubBase, setHubBase] = useState(settings.hub.baseUrl)

  useEffect(() => {
    setHubBase(settings.hub.baseUrl)
  }, [settings])

  const hubUrlValid = isValidGithubUrl(hubBase)

  const saveHub = async () => {
    const confirmed = await showMessage({
      message: 'Save Hub settings?',
      confirm: true
    })
    if (!confirmed) return

    const next: AppSettings = {
      ...settings,
      hub: {
        ...settings.hub,
        baseUrl: hubBase,
        catalogUrl: `${hubBase.replace(/\/$/, '')}/hub/manifest.json`
      }
    }
    await window.agentManager.saveSettings(next)
    onChange(next)
    await loadSettings()
    await showMessage({ message: 'Hub settings saved', type: 'success' })
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
        <h3 className="text-sm font-medium text-zinc-400 uppercase">Catalog URL</h3>
        <p className="text-xs text-zinc-500">
          Base GitHub URL for the Hub catalog. The manifest is expected at{' '}
          <code className="text-zinc-400">{'{baseUrl}/hub/manifest.json'}</code>.
        </p>
        <input
          value={hubBase}
          onChange={(e) => setHubBase(e.target.value)}
          placeholder="https://github.com/…"
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void fetchHub()}
            disabled={!hubUrlValid}
            className="px-4 py-2 text-sm bg-zinc-800 rounded disabled:opacity-40"
          >
            Fetch Hub catalog
          </button>
          <button
            type="button"
            onClick={() => void saveHub()}
            className="px-4 py-2 text-sm bg-emerald-700 hover:bg-emerald-600 rounded"
          >
            Save Hub settings
          </button>
        </div>
      </section>
    </div>
  )
}
