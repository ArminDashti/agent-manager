import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { MarkdownEditor } from '@renderer/components/MarkdownEditor'
import { showMessage } from '@renderer/stores/messageStore'

export function InstructionsPage() {
  const [files, setFiles] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)

  const loadList = useCallback(async () => {
    const list = await window.agentManager.listInstructions()
    setFiles(list)
    if (list.length > 0 && !selected) {
      setSelected(list[0])
    }
  }, [selected])

  useEffect(() => {
    void loadList()
  }, [])

  useEffect(() => {
    if (!selected) return
    setLoading(true)
    window.agentManager
      .readInstruction(selected)
      .then((c) => setContent(c))
      .finally(() => setLoading(false))
  }, [selected])

  const handleSave = async (value: string) => {
    if (!selected) return
    await window.agentManager.saveInstruction(selected, value)
    setContent(value)
  }

  const handleCreate = async () => {
    const name = prompt('New instruction file name (without .md):')
    if (!name?.trim()) return
    try {
      const created = await window.agentManager.createInstruction(name.trim())
      await loadList()
      setSelected(created)
    } catch (e) {
      await showMessage({
        message: e instanceof Error ? e.message : 'Failed to create file',
        type: 'error'
      })
    }
  }

  return (
    <div className="flex h-full min-h-0">
      <aside className="w-52 shrink-0 border-r border-zinc-800 flex flex-col">
        <div className="flex items-center justify-between px-3 py-3 border-b border-zinc-800">
          <span className="text-sm font-medium text-zinc-300">Instructions</span>
          <button
            type="button"
            onClick={() => void handleCreate()}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            title="New instruction file"
          >
            <Plus size={15} />
          </button>
        </div>
        <nav className="flex-1 overflow-auto py-1">
          {files.length === 0 ? (
            <p className="px-3 py-4 text-xs text-zinc-500">No instruction files yet.</p>
          ) : (
            files.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setSelected(f)}
                className={`w-full text-left px-3 py-2 text-sm truncate transition-colors ${
                  selected === f
                    ? 'bg-blue-600/20 text-blue-400'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
                title={f}
              >
                {f.replace(/\.md$/, '')}
              </button>
            ))
          )}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        {selected ? (
          loading ? (
            <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
              Loading…
            </div>
          ) : (
            <MarkdownEditor
              filePath={selected}
              value={content}
              onChange={setContent}
              onSave={handleSave}
              className="flex-1 border-none rounded-none"
            />
          )
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
            Select an instruction file to edit
          </div>
        )}
      </div>
    </div>
  )
}
