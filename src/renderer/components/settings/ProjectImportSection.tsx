import { useMemo } from 'react'
import { Trash2 } from 'lucide-react'
import type { AppSettings, ProjectInfo } from '@shared/types'
import { useAppStore } from '@renderer/stores/appStore'
import { showMessage } from '@renderer/stores/messageStore'

interface ProjectImportSectionProps {
  settings: AppSettings
  onChange: (settings: AppSettings) => void
}

export function ProjectImportSection({ settings, onChange }: ProjectImportSectionProps) {
  const { loadSettings, refreshScan } = useAppStore()

  const projects = useMemo(
    () => settings.projectRoots.flatMap((r) => r.projects).sort((a, b) => a.name.localeCompare(b.name)),
    [settings]
  )

  const importProjects = async () => {
    const paths = await window.agentManager.openDirectories()
    if (paths.length === 0) return
    try {
      const result = await window.agentManager.importProjects(paths)
      await loadSettings()
      const updated = await window.agentManager.getSettings()
      onChange(updated)
      await refreshScan()
      await showMessage({
        message: `Imported ${result.imported} project(s)`,
        type: 'success'
      })
    } catch (e) {
      await showMessage({
        message: e instanceof Error ? e.message : 'Import failed',
        type: 'error'
      })
    }
  }

  const removeProject = async (project: ProjectInfo) => {
    const confirmed = await showMessage({
      message: `Remove "${project.name}" from configured projects?`,
      confirm: true,
      type: 'error',
      title: 'Remove project'
    })
    if (!confirmed) return
    await window.agentManager.removeProject(project.id)
    await loadSettings()
    const updated = await window.agentManager.getSettings()
    onChange(updated)
    await refreshScan()
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium text-zinc-400 uppercase">Projects</h3>
      <p className="text-xs text-zinc-500">
        Import one or more git repositories or parent folders. Skills, hooks, rules, and sub-agents
        are loaded from imported projects only.
      </p>
      <button
        type="button"
        onClick={() => void importProjects()}
        className="px-4 py-2 text-sm bg-blue-600 rounded"
      >
        Import projects
      </button>

      {projects.length === 0 ? (
        <p className="text-sm text-zinc-500">No projects configured yet.</p>
      ) : (
        <div className="border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 text-zinc-400 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Path</th>
                <th className="px-3 py-2 w-12" />
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id} className="border-t border-zinc-800">
                  <td className="px-3 py-2 text-zinc-200">{project.name}</td>
                  <td className="px-3 py-2 text-zinc-500 font-mono text-xs truncate max-w-md">
                    {project.path}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => void removeProject(project)}
                      className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-red-400"
                      title="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
