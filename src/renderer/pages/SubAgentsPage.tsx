import { useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { MarkdownEditor } from '@renderer/components/MarkdownEditor'
import { useAppStore } from '@renderer/stores/appStore'
import type { SubAgentResource } from '@shared/types'

export function SubAgentsPage() {
  const { scan, refreshScan, loading } = useAppStore()
  const [selected, setSelected] = useState<SubAgentResource | null>(null)
  const [content, setContent] = useState('')

  const agents = useMemo(
    () =>
      (scan?.subAgents ?? [])
        .filter((a) => a.source.id === 'cursor' || a.source.label.includes('Cursor'))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [scan]
  )

  const selectAgent = async (agent: SubAgentResource) => {
    setSelected(agent)
    setContent(await window.agentManager.readFile(agent.filePath))
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div>
          <h2 className="text-lg font-medium">Sub-agents</h2>
          <p className="text-xs text-zinc-500">Cursor only</p>
        </div>
        <button type="button" onClick={() => void refreshScan()} className="px-3 py-1.5 text-sm bg-zinc-800 rounded">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>
      <div className="flex flex-1 min-h-0">
        <div className="w-72 border-r border-zinc-800 overflow-auto">
          {agents.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => void selectAgent(a)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-900 ${
                selected?.id === a.id ? 'bg-zinc-800' : ''
              }`}
            >
              {a.name}
              <div className="text-xs text-zinc-500 truncate">{a.description}</div>
            </button>
          ))}
        </div>
        <div className="flex-1 p-2">
          {selected ? (
            <MarkdownEditor
              filePath={selected.filePath}
              value={content}
              onChange={setContent}
              onSave={async (v) => {
                await window.agentManager.writeFile(selected.filePath, v)
              }}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-zinc-500">Select a sub-agent</div>
          )}
        </div>
      </div>
    </div>
  )
}
