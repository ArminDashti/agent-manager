import type { AppSettings } from '@shared/types'
import { useAppStore } from '@renderer/stores/appStore'
import { showMessage } from '@renderer/stores/messageStore'
import { ProjectImportSection } from './ProjectImportSection'

interface StorageTabProps {
  settings: AppSettings
  onChange: (settings: AppSettings) => void
}

export function StorageTab({ settings, onChange }: StorageTabProps) {
  const { loadSettings } = useAppStore()

  const saveRepoUrl = async (repoUrl: string) => {
    const next = {
      ...settings,
      repoBank: { ...settings.repoBank, url: repoUrl }
    }
    await window.agentManager.saveSettings(next)
    onChange(next)
    await loadSettings()
    await showMessage({ message: 'Git backup URL saved', type: 'success' })
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
          defaultValue={settings.repoBank.url}
          onBlur={(e) => void saveRepoUrl(e.target.value)}
          placeholder="https://github.com/user/repo.git"
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <button type="button" onClick={() => void fetchBank()} className="px-4 py-2 text-sm bg-zinc-800 rounded">
            Pull latest
          </button>
          <button type="button" onClick={() => void commitPush()} className="px-4 py-2 text-sm bg-blue-600 rounded">
            Commit &amp; push backup
          </button>
        </div>
      </section>

      <ProjectImportSection settings={settings} onChange={onChange} />
    </div>
  )
}
