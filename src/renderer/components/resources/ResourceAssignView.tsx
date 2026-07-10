import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ProjectMatrixRow, ResourceType } from '@shared/types'
import { ResourceSubViewHeader } from './ResourceListView'
import { ResourceTable } from './ResourceTable'

type ListableResourceType = Exclude<ResourceType, 'mcp'>

interface ResourceAssignViewProps {
  resourceType: ListableResourceType
  resourceName: string
  onBack: () => void
  onSaved?: () => void
}

export function ResourceAssignView({
  resourceType,
  resourceName,
  onBack,
  onSaved
}: ResourceAssignViewProps) {
  const [rows, setRows] = useState<ProjectMatrixRow[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const matrix = await window.agentManager.getProjectMatrix(resourceType, resourceName)
      setRows(matrix)
      setSelected(new Set(matrix.filter((r) => r.assigned).map((r) => r.projectId)))
    } finally {
      setLoading(false)
    }
  }, [resourceType, resourceName])

  useEffect(() => {
    void load()
  }, [load])

  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const cmp = a.projectName.localeCompare(b.projectName)
        return sortDir === 'asc' ? cmp : -cmp
      }),
    [rows, sortDir]
  )

  const toggle = (projectId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) next.delete(projectId)
      else next.add(projectId)
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await window.agentManager.applyProjectAssignment(
        resourceType,
        resourceName,
        [...selected]
      )
      onSaved?.()
      onBack()
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    {
      key: 'assigned',
      label: '',
      className: 'w-12',
      render: (row: ProjectMatrixRow) => (
        <input
          type="checkbox"
          checked={selected.has(row.projectId)}
          onChange={() => toggle(row.projectId)}
        />
      )
    },
    {
      key: 'name',
      label: 'Project',
      sortable: true,
      render: (row: ProjectMatrixRow) => (
        <span className="text-zinc-200">{row.projectName}</span>
      )
    }
  ]

  return (
    <div className="flex flex-col h-full">
      <ResourceSubViewHeader title={`Assign: ${resourceName}`} onBack={onBack} />
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">Loading…</div>
      ) : (
        <>
          <ResourceTable
            columns={columns}
            rows={sorted}
            rowKey={(r) => r.projectId}
            sortKey="name"
            sortDir={sortDir}
            onSort={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
            emptyMessage="No projects configured. Add project roots in settings.json."
          />
          <div className="flex justify-end gap-2 px-4 py-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2 text-sm bg-zinc-800 rounded hover:bg-zinc-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 rounded hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
