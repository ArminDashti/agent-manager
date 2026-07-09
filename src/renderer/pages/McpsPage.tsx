import { useMemo, useState } from 'react'
import { CloudDownload, RefreshCw } from 'lucide-react'
import { JsonEditor } from '@renderer/components/JsonEditor'
import { useAppStore } from '@renderer/stores/appStore'
import type { McpResource } from '@shared/types'

export function McpsPage() {
  const { scan, refreshScan, loading, setPage, setHubFilter } = useAppStore()
  const [selected, setSelected] = useState<McpResource | null>(null)
  const [paramsJson, setParamsJson] = useState('')

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

  const selectMcp = (mcp: McpResource) => {
    setSelected(mcp)
    setParamsJson(JSON.stringify(mcp.params, null, 2))
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h2 className="text-lg font-medium">MCPs</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setHubFilter('mcp')
              setPage('hub')
            }}
            className="px-3 py-1.5 text-sm bg-zinc-800 rounded flex items-center gap-1"
          >
            <CloudDownload size={14} /> Browse Hub
          </button>
          <button type="button" onClick={() => void refreshScan()} className="px-3 py-1.5 text-sm bg-zinc-800 rounded">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>
      <div className="flex flex-1 min-h-0">
        <div className="w-72 border-r border-zinc-800 overflow-auto">
          {mcps.map((m) => (
            <button
              key={m.id + m.configPath}
              type="button"
              onClick={() => selectMcp(m)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-900 ${
                selected?.name === m.name ? 'bg-zinc-800' : ''
              }`}
            >
              {m.name}
              <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400">{m.status}</span>
            </button>
          ))}
        </div>
        <div className="flex-1 p-4 overflow-auto">
          {selected ? (
            <div className="space-y-4 max-w-3xl">
              <div>
                <h3 className="text-xl font-medium">{selected.name}</h3>
                <p className="text-sm text-zinc-500">Platforms: {selected.platforms.join(', ')}</p>
              </div>
              <div className="h-96">
                <JsonEditor
                  value={paramsJson}
                  onChange={setParamsJson}
                  onSave={async (v) => {
                    const config = JSON.parse(await window.agentManager.readFile(selected.configPath))
                    config.mcpServers ??= {}
                    config.mcpServers[selected.name] = JSON.parse(v)
                    await window.agentManager.writeFile(
                      selected.configPath,
                      JSON.stringify(config, null, 2)
                    )
                  }}
                />
              </div>
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
          ) : (
            <div className="h-full flex items-center justify-center text-zinc-500">Select an MCP server</div>
          )}
        </div>
      </div>
    </div>
  )
}
