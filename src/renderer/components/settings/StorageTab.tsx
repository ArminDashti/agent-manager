import { useEffect, useState } from 'react'
import type { AppSettings } from '@shared/types'
import { useAppStore } from '@renderer/stores/appStore'
import { showMessage } from '@renderer/stores/messageStore'
interface StorageTabProps {
  settings: AppSettings
  onChange: (settings: AppSettings) => void
}

export function StorageTab({ settings, onChange }: StorageTabProps) {
  const { loadSettings } = useAppStore()
  const [repoUrl, setRepoUrl] = useState(settings.repoBank.url)
  const patValid = settings.github?.patValid ?? false

  useEffect(() => {
    setRepoUrl(settings.repoBank.url)
  }, [settings.repoBank.url])

  const saveStorage = async () => {
    const confirmed = await showMessage({
      message: 'Save storage settings?',
      confirm: true
    })
    if (!confirmed) return

    const next = {
      ...settings,
      repoBank: { ...settings.repoBank, url: repoUrl }
    }
    await window.agentManager.saveSettings(next)
    onChange(next)
    await loadSettings()
    await showMessage({ message: 'Storage settings saved', type: 'success' })
  }

  const fetchBank = async () => {
    try {
      await window.agentManager.repoBankFetch()
      await showMessage({ message: 'Git backup pulled', type: 'success' })
    } catch (e) {
      await showMessage({
        message: e instanceof Error ? e.message : 'Fetch failed',
        type: 'error'
      })
    }
  }

  const commitPush = async () => {
    try {
      await window.agentManager.repoBankCommitPush('Janus backup')
      await showMessage({ message: 'Committed and pushed', type: 'success' })
    } catch (e) {
      await showMessage({
        message: e instanceof Error ? e.message : 'Push failed',
        type: 'error'
      })
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h3 className="text-sm font-medium text-zinc-400 uppercase">Git Backup</h3>
        <p className="text-xs text-zinc-500">
          Personal Git repository for backing up and syncing your agent resources.
        </p>
        <input
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="https://github.com/user/repo.git"
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void fetchBank()}
            disabled={!patValid}
            className="px-4 py-2 text-sm bg-zinc-800 rounded disabled:opacity-40"
          >
            Pull latest
          </button>
          <button
            type="button"
            onClick={() => void commitPush()}
            disabled={!patValid}
            className="px-4 py-2 text-sm bg-blue-600 rounded disabled:opacity-40"
          >
            Commit &amp; push backup
          </button>
        </div>
        {!patValid && (
          <p className="text-xs text-amber-500">Save a valid GitHub PAT in General settings first</p>
        )}
      </section>

      <button type="button" onClick={() => void saveStorage()} className="px-4 py-2 text-sm bg-emerald-700 rounded">
        Save storage settings
      </button>
    </div>
  )
}
