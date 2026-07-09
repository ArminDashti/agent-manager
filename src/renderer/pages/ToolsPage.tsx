import { useMemo, useState } from 'react'
import { CloudDownload, RefreshCw } from 'lucide-react'
import { FileTree } from '@renderer/components/FileTree'
import { MarkdownEditor } from '@renderer/components/MarkdownEditor'
import { JsonEditor } from '@renderer/components/JsonEditor'
import { useAppStore } from '@renderer/stores/appStore'
import type { ToolResource } from '@shared/types'
import { isMarkdownFile } from '@shared/utils.browser'

export function ToolsPage() {
  const { scan, refreshScan, loading, setPage, setHubFilter } = useAppStore()
  const [selected, setSelected] = useState<ToolResource | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [content, setContent] = useState('')

  const tools = useMemo(
    () => (scan?.tools ?? []).sort((a, b) => a.name.localeCompare(b.name)),
    [scan]
  )

  const selectTool = async (tool: ToolResource) => {
    setSelected(tool)
    const file = tool.files.find((f) => f.endsWith('tool.json')) ?? tool.files[0]
    if (file) {
      setSelectedFile(file)
      setContent(await window.agentManager.readFile(file))
    }
  }

  const openFile = async (path: string) => {
    setSelectedFile(path)
    setContent(await window.agentManager.readFile(path))
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h2 className="text-lg font-medium">Tools</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setHubFilter('tool')
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
          {tools.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => void selectTool(t)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-900 ${
                selected?.id === t.id ? 'bg-zinc-800' : ''
              }`}
            >
              {t.name}
              <div className="text-xs text-zinc-500">{t.description ?? t.source.label}</div>
            </button>
          ))}
        </div>
        <div className="w-56 border-r border-zinc-800">
          {selected && (
            <FileTree
              files={selected.files}
              selected={selectedFile ?? undefined}
              onSelect={(p) => void openFile(p)}
              rootPath={selected.rootPath}
            />
          )}
        </div>
        <div className="flex-1 p-2">
          {selectedFile ? (
            isMarkdownFile(selectedFile) ? (
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
            <div className="h-full flex items-center justify-center text-zinc-500">Select a tool</div>
          )}
        </div>
      </div>
    </div>
  )
}
