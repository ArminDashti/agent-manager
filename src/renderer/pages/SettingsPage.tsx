import { useEffect, useState } from 'react'
import { DEFAULT_PLATFORM_ROOTS, PLATFORM_IDS, PLATFORM_LABELS, type PlatformId } from '@shared/types'
import { useAppStore } from '@renderer/stores/appStore'
import { PlatformLogo } from '@renderer/components/PlatformLogo'

export function SettingsPage() {
  const { settings, loadSettings } = useAppStore()
  const [pat, setPat] = useState('')
  const [repoUrl, setRepoUrl] = useState('')
  const [hubBase, setHubBase] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    void loadSettings()
    void window.agentManager.getPat().then(setPat)
  }, [loadSettings])

  useEffect(() => {
    if (settings) {
      setRepoUrl(settings.repoBank.url)
      setHubBase(settings.hub.baseUrl)
    }
  }, [settings])

  const savePat = async () => {
    await window.agentManager.setPat(pat)
    setStatus('PAT saved')
  }

  const saveSettings = async () => {
    if (!settings) return
    const next = {
      ...settings,
      repoBank: { ...settings.repoBank, url: repoUrl },
      hub: {
        ...settings.hub,
        baseUrl: hubBase,
        catalogUrl: `${hubBase.replace(/\/$/, '')}/hub/manifest.json`
      }
    }
    await window.agentManager.saveSettings(next)
    await loadSettings()
    setStatus('Settings saved')
  }

  const fetchBank = async () => {
    try {
      await window.agentManager.repoBankFetch()
      setStatus('Repo Bank fetched')
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Fetch failed')
    }
  }

  const commitPush = async () => {
    try {
      await window.agentManager.repoBankCommitPush('Agent Manager backup')
      setStatus('Committed and pushed')
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Push failed')
    }
  }

  const fetchHub = async () => {
    try {
      await window.agentManager.hubFetchCatalog()
      setStatus('Hub catalog fetched')
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Hub fetch failed')
    }
  }

  const addProjectRoot = async () => {
    const dir = await window.agentManager.openDirectory()
    if (dir) {
      await window.agentManager.addProjectRoot(dir)
      await loadSettings()
      setStatus(`Added project root: ${dir}`)
    }
  }

  const updatePlatformPath = async (id: PlatformId, rootPath: string) => {
    if (!settings) return
    const platforms = settings.platforms.map((p) => (p.id === id ? { ...p, rootPath } : p))
    await window.agentManager.saveSettings({ ...settings, platforms })
    await loadSettings()
  }

  return (
    <div className="h-full overflow-auto p-6 max-w-2xl space-y-8">
      <h2 className="text-lg font-medium">Settings</h2>
      {status && <p className="text-sm text-emerald-400">{status}</p>}

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
        <h3 className="text-sm font-medium text-zinc-400 uppercase">Platforms</h3>
        {PLATFORM_IDS.map((id) => {
          const p = settings?.platforms.find((x) => x.id === id)
          return (
            <div key={id} className="flex items-center gap-3">
              <PlatformLogo platformId={id} />
              <span className="w-24 text-sm">{PLATFORM_LABELS[id]}</span>
              <input
                defaultValue={p?.rootPath ?? DEFAULT_PLATFORM_ROOTS[id]}
                onBlur={(e) => void updatePlatformPath(id, e.target.value)}
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm"
              />
            </div>
          )
        })}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-zinc-400 uppercase">Project roots</h3>
        <button type="button" onClick={() => void addProjectRoot()} className="px-4 py-2 text-sm bg-zinc-800 rounded">
          Add project folder
        </button>
        <ul className="text-sm text-zinc-400 space-y-1">
          {settings?.projectRoots.map((r) => (
            <li key={r.id}>
              {r.scanPath} ({r.projects.length} projects)
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-zinc-400 uppercase">Repo Bank</h3>
        <input
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="https://github.com/user/repo.git"
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <button type="button" onClick={() => void fetchBank()} className="px-4 py-2 text-sm bg-zinc-800 rounded">
            Fetch
          </button>
          <button type="button" onClick={() => void commitPush()} className="px-4 py-2 text-sm bg-blue-600 rounded">
            Commit and Push
          </button>
        </div>
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

      <button type="button" onClick={() => void saveSettings()} className="px-4 py-2 text-sm bg-emerald-700 rounded">
        Save all settings
      </button>
    </div>
  )
}
