import { useMemo, useState } from 'react'
import { CloudDownload, RefreshCw } from 'lucide-react'
import { MarkdownEditor } from '@renderer/components/MarkdownEditor'
import { useAppStore } from '@renderer/stores/appStore'
import type { RuleResource } from '@shared/types'

export function RulesPage() {
  const { scan, refreshScan, loading, searchQuery, setPage, setHubFilter } = useAppStore()
  const [selected, setSelected] = useState<RuleResource | null>(null)
  const [content, setContent] = useState('')

  const rules = useMemo(() => {
    const list = scan?.rules ?? []
    if (!searchQuery) return list.sort((a, b) => a.name.localeCompare(b.name))
    return list
      .filter((r) => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [scan, searchQuery])

  const selectRule = async (rule: RuleResource) => {
    setSelected(rule)
    setContent(await window.agentManager.readFile(rule.filePath))
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h2 className="text-lg font-medium">Rules</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setHubFilter('rule')
              setPage('hub')
            }}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-zinc-800 rounded"
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
          {rules.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => void selectRule(r)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-900 ${
                selected?.id === r.id ? 'bg-zinc-800' : ''
              }`}
            >
              {r.name}
              <div className="text-xs text-zinc-500">{r.source.label}</div>
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
            <div className="h-full flex items-center justify-center text-zinc-500">Select a rule</div>
          )}
        </div>
      </div>
    </div>
  )
}
