import { useMemo, useState } from 'react'
import { CloudDownload, RefreshCw } from 'lucide-react'
import { FileTree } from '@renderer/components/FileTree'
import { MarkdownEditor } from '@renderer/components/MarkdownEditor'
import { JsonEditor } from '@renderer/components/JsonEditor'
import { useAppStore } from '@renderer/stores/appStore'
import type { HookResource } from '@shared/types'
import { isMarkdownFile } from '@shared/utils.browser'

export function HooksPage() {
  const { scan, refreshScan, loading, setPage, setHubFilter } = useAppStore()
  const [selected, setSelected] = useState<HookResource | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [content, setContent] = useState('')

  const hooks = useMemo(() => {
    return (scan?.hooks ?? []).filter((h) => h.source.id === 'cursor' || h.source.label.includes('Cursor'))
  }, [scan])

  const files = useMemo(() => {
    if (!selected) return []
    const list = [...selected.scriptFiles]
    if (!list.includes(selected.configPath)) list.unshift(selected.configPath)
    return list
  }, [selected])

  const openHook = async (hook: HookResource) => {
    setSelected(hook)
    const file = hook.scriptPath ?? hook.configPath
    setSelectedFile(file)
    setContent(await window.agentManager.readFile(file))
  }

  const openFile = async (path: string) => {
    setSelectedFile(path)
    setContent(await window.agentManager.readFile(path))
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div>
          <h2 className="text-lg font-medium">Hooks</h2>
          <p className="text-xs text-zinc-500">Cursor only</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setHubFilter('hook')
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
        <div className="w-64 border-r border-zinc-800 overflow-auto">
          {hooks.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => void openHook(h)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-900 ${
                selected?.id === h.id ? 'bg-zinc-800' : ''
              }`}
            >
              <div>{h.name}</div>
              <div className="text-xs text-zinc-500">{h.event}</div>
            </button>
          ))}
        </div>
        <div className="w-56 border-r border-zinc-800">
          {selected && (
            <FileTree files={files} selected={selectedFile ?? undefined} onSelect={(p) => void openFile(p)} />
          )}
        </div>
        <div className="flex-1 p-2">
          {selectedFile ? (
            isMarkdownFile(selectedFile) || selectedFile.endsWith('.py') ? (
              <MarkdownEditor
                filePath={selectedFile}
                value={content}
                onChange={setContent}
                onSave={async (v) => {
                  await window.agentManager.writeFile(selectedFile, v)
                }}
              />
            ) : (
              <JsonEditor
                value={content}
                onChange={setContent}
                onSave={async (v) => {
                  await window.agentManager.writeFile(selectedFile, v)
                }}
              />
            )
          ) : (
            <div className="h-full flex items-center justify-center text-zinc-500">Select a hook (Cursor)</div>
          )}
        </div>
      </div>
    </div>
  )
}
