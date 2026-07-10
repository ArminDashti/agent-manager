import { useEffect, useMemo, useState } from 'react'
import type { ResourceType } from '@shared/types'
import { useAppStore } from '@renderer/stores/appStore'
import { showMessage } from '@renderer/stores/messageStore'

type CreatableResourceType = 'skill' | 'rule' | 'hook' | 'subAgent'

interface AddResourceModalProps {
  resourceType: CreatableResourceType
  onClose: () => void
  onCreated: (name?: string) => void
}

const TYPE_LABELS: Record<CreatableResourceType, string> = {
  skill: 'Skill',
  rule: 'Rule',
  hook: 'Hook',
  subAgent: 'Sub-agent'
}

export function AddResourceModal({ resourceType, onClose, onCreated }: AddResourceModalProps) {
  const { settings, loadSettings, refreshScan } = useAppStore()
  const [name, setName] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const isSkill = resourceType === 'skill'

  const projects = useMemo(
    () => settings?.projectRoots.flatMap((r) => r.projects) ?? [],
    [settings]
  )

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  const toggleProject = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allSelected = projects.length > 0 && selectedIds.size === projects.length

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(projects.map((p) => p.id)))
    }
  }

  const handleCreate = async () => {
    if (!name.trim()) {
      await showMessage({ message: 'Name is required', type: 'error' })
      return
    }
    if (selectedIds.size === 0) {
      await showMessage({ message: 'Select at least one project', type: 'error' })
      return
    }
    setSaving(true)
    const createdName = name.trim()
    try {
      await window.agentManager.createResource(resourceType, createdName, [...selectedIds])
      await refreshScan()
      onCreated(isSkill ? createdName : undefined)
      if (!isSkill) {
        await showMessage({
          message: `${TYPE_LABELS[resourceType]} "${createdName}" created in projects and Git backup`,
          type: 'success'
        })
      }
      onClose()
    } catch (e) {
      await showMessage({
        message: e instanceof Error ? e.message : 'Create failed',
        type: 'error'
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div
        className={`bg-zinc-900 border border-zinc-700 rounded-lg p-6 max-h-[85vh] flex flex-col ${
          isSkill ? 'w-[720px]' : 'w-[480px]'
        }`}
      >
        <h3 className="font-medium mb-4">Add {TYPE_LABELS[resourceType]}</h3>

        <label className="text-sm text-zinc-400 mb-1 block">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`my-${resourceType}`}
          className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm mb-4"
        />

        <div className="flex items-center justify-between mb-2">
          <label className="text-sm text-zinc-400">Target projects</label>
          {projects.length > 0 && (
            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
          )}
        </div>
        <div
          className={`flex-1 overflow-auto border border-zinc-800 rounded mb-4 ${
            isSkill ? 'min-h-64 max-h-72' : 'max-h-48'
          }`}
        >
          {projects.length === 0 ? (
            <p className="p-3 text-sm text-zinc-500">No projects configured. Import projects in Settings.</p>
          ) : (
            projects.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800 last:border-0 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(p.id)}
                  onChange={() => toggleProject(p.id)}
                />
                <span className="text-zinc-200">{p.name}</span>
                <span className="text-zinc-500 text-xs truncate">{p.path}</span>
              </label>
            ))
          )}
        </div>

        <p className="text-xs text-zinc-500 mb-4">
          Creates in each project&apos;s .cursor folder and mirrors to the Git backup repo.
        </p>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm bg-zinc-800 rounded">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 rounded disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function isCreatableResourceType(type: ResourceType): type is CreatableResourceType {
  return type === 'skill' || type === 'rule' || type === 'hook' || type === 'subAgent'
}
