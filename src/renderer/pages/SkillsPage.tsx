import { useMemo, useState } from 'react'
import { CloudDownload, RefreshCw, Share2 } from 'lucide-react'
import { FileTree } from '@renderer/components/FileTree'
import { MarkdownEditor } from '@renderer/components/MarkdownEditor'
import { AssignDialog } from '@renderer/components/AssignDialog'
import { useAppStore } from '@renderer/stores/appStore'
import type { SkillResource } from '@shared/types'

export function SkillsPage() {
  const { scan, refreshScan, loading, searchQuery, setPage, setHubFilter } = useAppStore()
  const [selected, setSelected] = useState<SkillResource | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [assignOpen, setAssignOpen] = useState(false)

  const skills = useMemo(() => {
    const list = scan?.skills ?? []
    if (!searchQuery) return list
    return list.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [scan, searchQuery])

  const selectSkill = async (skill: SkillResource) => {
    setSelected(skill)
    const file = skill.skillMdPath
    setSelectedFile(file)
    setContent(await window.agentManager.readFile(file))
  }

  const selectFile = async (path: string) => {
    setSelectedFile(path)
    setContent(await window.agentManager.readFile(path))
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h2 className="text-lg font-medium">Skills</h2>
        <div className="flex gap-2">
          {selected && (
            <button
              type="button"
              onClick={() => setAssignOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 rounded"
            >
              <Share2 size={14} /> Assign
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setHubFilter('skill')
              setPage('hub')
            }}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 rounded"
          >
            <CloudDownload size={14} /> Browse Hub
          </button>
          <button
            type="button"
            onClick={() => void refreshScan()}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 rounded"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </header>
      <div className="flex flex-1 min-h-0">
        <div className="w-64 border-r border-zinc-800 overflow-auto">
          {skills.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => void selectSkill(s)}
              className={`w-full text-left px-3 py-2 text-sm border-b border-zinc-900 hover:bg-zinc-900 ${
                selected?.id === s.id ? 'bg-zinc-800' : ''
              }`}
            >
              <div className="font-medium">{s.name}</div>
              <div className="text-xs text-zinc-500">{s.source.label}</div>
            </button>
          ))}
        </div>
        <div className="w-56 border-r border-zinc-800">
          {selected && (
            <FileTree
              files={selected.files}
              selected={selectedFile ?? undefined}
              onSelect={(p) => void selectFile(p)}
              rootPath={selected.rootPath}
            />
          )}
        </div>
        <div className="flex-1 p-2 min-w-0">
          {selectedFile ? (
            <MarkdownEditor
              filePath={selectedFile}
              value={content}
              onChange={setContent}
              onSave={async (v) => {
                await window.agentManager.writeFile(selectedFile, v)
              }}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
              Select a skill
            </div>
          )}
        </div>
      </div>
      <AssignDialog
        resourceType="skill"
        resourceName={selected?.name ?? ''}
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        onAssigned={() => void refreshScan()}
      />
    </div>
  )
}
