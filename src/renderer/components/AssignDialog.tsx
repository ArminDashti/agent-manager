import { useEffect, useState } from 'react'
import type { AssignTarget, ResourceType } from '@shared/types'
import { PlatformLogo } from './PlatformLogo'

interface AssignDialogProps {
  resourceType: ResourceType
  resourceName: string
  open: boolean
  onClose: () => void
  onAssigned?: () => void
}

export function AssignDialog({
  resourceType,
  resourceName,
  open,
  onClose,
  onAssigned
}: AssignDialogProps) {
  const [targets, setTargets] = useState<AssignTarget[]>([])
  const [selected, setSelected] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    void window.agentManager.getAssignTargets(resourceType).then(setTargets)
  }, [open, resourceType])

  if (!open) return null

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 w-[420px] max-h-[80vh] flex flex-col">
        <h3 className="font-medium mb-1">Assign: {resourceName}</h3>
        <p className="text-xs text-zinc-500 mb-4 capitalize">{resourceType} → platform or project</p>
        <div className="flex-1 overflow-auto space-y-1 mb-4">
          {targets.map((t) => (
            <label
              key={t.id}
              className="flex items-center gap-2 px-2 py-2 rounded hover:bg-zinc-800 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.includes(t.id)}
                onChange={() => toggle(t.id)}
              />
              <PlatformLogo platformId={t.platformId} size={18} />
              <span className="text-sm">{t.label}</span>
            </label>
          ))}
          {targets.length === 0 && (
            <p className="text-sm text-zinc-500">
              {resourceType === 'hook' || resourceType === 'subAgent'
                ? 'Only Cursor targets are available for this resource type.'
                : 'No targets configured.'}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm bg-zinc-800 rounded">
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              onAssigned?.()
              onClose()
            }}
            className="px-4 py-2 text-sm bg-blue-600 rounded"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
