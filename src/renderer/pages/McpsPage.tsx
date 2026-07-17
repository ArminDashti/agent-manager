import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { JsonEditor } from '@renderer/components/JsonEditor'
import { ResourceTable } from '@renderer/components/resources/ResourceTable'
import { ResourceSubViewHeader } from '@renderer/components/resources/ResourceListView'
import { useAppStore } from '@renderer/stores/appStore'
import { showMessage } from '@renderer/stores/messageStore'
import { cn } from '@renderer/lib/utils'
import type { McpResource } from '@shared/types'

type ViewMode = 'list' | 'edit'

function statusBadgeClass(status: McpResource['status']): string {
  switch (status) {
    case 'connected':
      return 'bg-emerald-900/50 text-emerald-400'
    case 'configured':
    case 'unknown':
      return 'bg-amber-900/40 text-amber-400'
    case 'error':
    case 'disconnected':
      return 'bg-red-900/40 text-red-400'
    default:
      return 'bg-zinc-800 text-zinc-400'
  }
}

export function McpsPage() {
  const { scan, refreshScan } = useAppStore()
  const [view, setView] = useState<ViewMode>('list')
  const [selected, setSelected] = useState<McpResource | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addJson, setAddJson] = useState('{\n  "command": "npx",\n  "args": ["-y", "some-mcp-server"]\n}')
  const [addName, setAddName] = useState('')
  const [paramsJson, setParamsJson] = useState('')

  useEffect(() => {
    void refreshScan({ probeMcps: true })
  }, [refreshScan])

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
    setParamsJson(JSON.stringify(mcp.params, null, 2))
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
    await refreshScan({ probeMcps: true })
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
      await refreshScan({ probeMcps: true })
    } catch (e) {
      await showMessage({
        message: e instanceof Error ? e.message : 'Invalid JSON',
        type: 'error'
      })
    }
  }

  const saveParams = async (jsonOverride?: string) => {
    if (!selected) return
    const confirmed = await showMessage({
      message: `Save changes to ${selected.name}?`,
      confirm: true
    })
    if (!confirmed) return
    try {
      const raw = jsonOverride ?? paramsJson
      const toSave = JSON.parse(raw) as Record<string, unknown>
      const config = JSON.parse(await window.agentManager.readFile(selected.configPath))
      config.mcpServers ??= {}
      config.mcpServers[selected.name] = toSave
      await window.agentManager.writeFile(selected.configPath, JSON.stringify(config, null, 2))
      setParamsJson(JSON.stringify(toSave, null, 2))
      await refreshScan({ probeMcps: true })
    } catch (e) {
      await showMessage({
        message: e instanceof Error ? e.message : 'Invalid JSON',
        type: 'error'
      })
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
        <div className="flex-1 flex flex-col min-h-0 p-4 gap-4">
          <div className="space-y-1 shrink-0">
            <p className="text-sm text-zinc-500">Platforms: {selected.platforms.join(', ')}</p>
            <p className="text-xs font-mono text-zinc-600 truncate" title={selected.configPath}>
              {selected.configPath}
            </p>
          </div>

          <div className="flex-1 min-h-0">
            <JsonEditor
              value={paramsJson}
              onChange={setParamsJson}
              onSave={async (v) => {
                setParamsJson(v)
                await saveParams(v)
              }}
            />
          </div>

          <div className="shrink-0 max-h-48 overflow-auto">
            <h4 className="text-sm font-medium mb-2">Tools</h4>
            {selected.tools.length === 0 ? (
              <p className="text-sm text-zinc-500">No cached tools (status: {selected.status})</p>
            ) : (
              <ul className="text-sm space-y-2">
                {selected.tools.map((t) => (
                  <li key={t.name} className="border-b border-zinc-800/80 pb-2 last:border-0">
                    <div className="font-medium text-zinc-200">{t.name}</div>
                    <div className="text-zinc-500 text-xs mt-0.5">
                      {t.description?.trim() || '—'}
                    </div>
                  </li>
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
        <span className={cn('text-xs px-2 py-0.5 rounded', statusBadgeClass(row.status))}>
          {row.status}
        </span>
      )
    },
    {
      key: 'tools',
      label: 'Tools',
      render: (row: McpResource) => (
        <span className="text-zinc-400">{row.tools.length}</span>
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
