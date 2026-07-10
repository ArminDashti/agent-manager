import { useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { JsonEditor } from '@renderer/components/JsonEditor'
import { McpFieldPicker } from '@renderer/components/McpFieldPicker'
import { McpFieldEditor } from '@renderer/components/McpFieldEditor'
import { ResourceTable } from '@renderer/components/resources/ResourceTable'
import { ResourceSubViewHeader } from '@renderer/components/resources/ResourceListView'
import { flattenParamPaths } from '@renderer/lib/mcpParams'
import { useAppStore } from '@renderer/stores/appStore'
import { showMessage } from '@renderer/stores/messageStore'
import type { McpResource } from '@shared/types'

type ViewMode = 'list' | 'edit'

export function McpsPage() {
  const { scan, refreshScan } = useAppStore()
  const [view, setView] = useState<ViewMode>('list')
  const [selected, setSelected] = useState<McpResource | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addJson, setAddJson] = useState('{\n  "command": "npx",\n  "args": ["-y", "some-mcp-server"]\n}')
  const [addName, setAddName] = useState('')
  const [params, setParams] = useState<Record<string, unknown>>({})
  const [selectedPath, setSelectedPath] = useState('command')
  const [showRawJson, setShowRawJson] = useState(false)
  const [paramsJson, setParamsJson] = useState('')
  const [saving, setSaving] = useState(false)

  const mcps = useMemo(() => {
    const map = new Map<string, McpResource>()
    for (const m of scan?.mcps ?? []) {
      const existing = map.get(m.name)
      if (existing) {
        existing.platforms = [...new Set([...existing.platforms, ...m.platforms])]
      } else {
        map.set(m.name, { ...m, platforms: [...m.platforms] })
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [scan])

  const openEdit = (mcp: McpResource) => {
    setSelected(mcp)
    setParams({ ...mcp.params })
    setParamsJson(JSON.stringify(mcp.params, null, 2))
    const paths = flattenParamPaths(mcp.params)
    setSelectedPath(paths[0]?.path ?? 'command')
    setShowRawJson(false)
    setView('edit')
  }

  const handleDelete = async (mcp: McpResource) => {
    const confirmed = await showMessage({
      message: `Remove MCP "${mcp.name}" from configuration?`,
      confirm: true,
      type: 'error',
      title: 'Remove MCP'
    })
    if (!confirmed) return
    await window.agentManager.deleteMcp(mcp.name, mcp.configPath)
    await refreshScan()
  }

  const handleAdd = async () => {
    if (!addName.trim()) {
      await showMessage({ message: 'Name is required', type: 'error' })
      return
    }
    try {
      const params = JSON.parse(addJson) as Record<string, unknown>
      await window.agentManager.addMcp(addName.trim(), params)
      setAddOpen(false)
      setAddName('')
      await refreshScan()
    } catch (e) {
      await showMessage({
        message: e instanceof Error ? e.message : 'Invalid JSON',
        type: 'error'
      })
    }
  }

  const saveParams = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const toSave = showRawJson ? JSON.parse(paramsJson) : params
      const config = JSON.parse(await window.agentManager.readFile(selected.configPath))
      config.mcpServers ??= {}
      config.mcpServers[selected.name] = toSave
      await window.agentManager.writeFile(selected.configPath, JSON.stringify(config, null, 2))
      setParams(toSave)
      setParamsJson(JSON.stringify(toSave, null, 2))
      await refreshScan()
    } finally {
      setSaving(false)
    }
  }

  if (view === 'edit' && selected) {
    return (
      <div className="flex flex-col h-full">
        <ResourceSubViewHeader
          title={`Edit: ${selected.name}`}
          onBack={() => {
            setView('list')
            setSelected(null)
          }}
        />
        <div className="flex-1 overflow-auto p-4 space-y-4">
          <p className="text-sm text-zinc-500">Platforms: {selected.platforms.join(', ')}</p>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              <input
                type="checkbox"
                checked={showRawJson}
                onChange={(e) => setShowRawJson(e.target.checked)}
              />
              Raw JSON
            </label>
            <button
              type="button"
              onClick={() => void saveParams()}
              disabled={saving}
              className="px-4 py-1.5 text-sm bg-emerald-700 hover:bg-emerald-600 rounded disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>

          {showRawJson ? (
            <div className="h-96">
              <JsonEditor
                value={paramsJson}
                onChange={setParamsJson}
                onSave={async (v) => {
                  setParamsJson(v)
                  await saveParams()
                }}
              />
            </div>
          ) : (
            <div className="space-y-3 max-w-2xl">
              <McpFieldPicker params={params} selectedPath={selectedPath} onSelect={setSelectedPath} />
              <McpFieldEditor params={params} selectedPath={selectedPath} onChange={setParams} />
            </div>
          )}

          <div>
            <h4 className="text-sm font-medium mb-2">Tools</h4>
            {selected.tools.length === 0 ? (
              <p className="text-sm text-zinc-500">No cached tools (status: {selected.status})</p>
            ) : (
              <ul className="text-sm space-y-1">
                {selected.tools.map((t) => (
                  <li key={t.name}>{t.name}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    )
  }

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (row: McpResource) => <span className="font-medium text-zinc-200">{row.name}</span>
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: McpResource) => (
        <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">{row.status}</span>
      )
    },
    {
      key: 'edit',
      label: '',
      className: 'w-16',
      render: (row: McpResource) => (
        <button
          type="button"
          onClick={() => openEdit(row)}
          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400"
          title="Edit"
        >
          <Pencil size={14} />
        </button>
      )
    },
    {
      key: 'delete',
      label: '',
      className: 'w-16',
      render: (row: McpResource) => (
        <button
          type="button"
          onClick={() => void handleDelete(row)}
          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-red-400"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      )
    }
  ]

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h2 className="text-lg font-medium">MCPs</h2>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 rounded"
        >
          <Plus size={14} /> Add MCP
        </button>
      </header>

      <ResourceTable
        columns={columns}
        rows={mcps}
        rowKey={(r) => r.name}
        emptyMessage="No MCP servers configured"
      />

      {addOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 w-[520px] max-h-[80vh] flex flex-col">
            <h3 className="font-medium mb-4">Add MCP Server</h3>
            <label className="text-sm text-zinc-400 mb-1 block">Server name</label>
            <input
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder="my-mcp-server"
              className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm mb-3"
            />
            <label className="text-sm text-zinc-400 mb-1 block">Configuration (JSON)</label>
            <textarea
              value={addJson}
              onChange={(e) => setAddJson(e.target.value)}
              rows={10}
              className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm font-mono flex-1 min-h-[200px]"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="px-4 py-2 text-sm bg-zinc-800 rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleAdd()}
                className="px-4 py-2 text-sm bg-blue-600 rounded"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
