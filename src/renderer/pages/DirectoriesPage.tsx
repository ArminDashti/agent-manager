import { useState } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { PlatformLogo } from '@renderer/components/PlatformLogo'
import { MarkdownEditor } from '@renderer/components/MarkdownEditor'
import { JsonEditor } from '@renderer/components/JsonEditor'
import { useAppStore } from '@renderer/stores/appStore'
import { DEFAULT_PLATFORM_ROOTS, PLATFORM_IDS, PLATFORM_LABELS, type PlatformId } from '@shared/types'
import { isMarkdownFile } from '@shared/utils.browser'
import type { HookResource, RuleResource, SkillResource, SubAgentResource } from '@shared/types'

type ResourceTab = 'skills' | 'rules' | 'hooks' | 'subagents'

export function DirectoriesPage() {
  const { scan, settings, refreshScan, loading } = useAppStore()
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [tab, setTab] = useState<ResourceTab>('skills')
  const [selectedItem, setSelectedItem] = useState<string | null>(null)
  const [editorContent, setEditorContent] = useState('')
  const [editorPath, setEditorPath] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [addType, setAddType] = useState<'platform' | 'project'>('platform')
  const [addPlatformId, setAddPlatformId] = useState<PlatformId>('cursor')
  const [addPath, setAddPath] = useState(DEFAULT_PLATFORM_ROOTS.cursor)

  const sourceId = selectedProject ?? selectedPlatform

  const filterBySource = <T extends { source: { id: string }; id: string }>(items: T[]) =>
    sourceId ? items.filter((i) => i.source.id === sourceId || i.source.id.startsWith(sourceId)) : []

  const skills = filterBySource(scan?.skills ?? [])
  const rules = filterBySource(scan?.rules ?? [])
  const hooks = filterBySource(scan?.hooks ?? [])
  const subAgents = filterBySource(scan?.subAgents ?? [])

  const openItem = async (path: string, isJson = false) => {
    const content = await window.agentManager.readFile(path)
    setEditorContent(content)
    setEditorPath(path)
    setSelectedItem(path)
  }

  const handleSelectSkill = async (skill: SkillResource) => {
    await openItem(skill.skillMdPath)
  }

  const handleSelectRule = async (rule: RuleResource) => {
    await openItem(rule.filePath)
  }

  const handleSelectHook = async (hook: HookResource) => {
    if (hook.scriptPath) await openItem(hook.scriptPath)
    else await openItem(hook.configPath, true)
  }

  const handleSelectSubAgent = async (agent: SubAgentResource) => {
    await openItem(agent.filePath)
  }

  const handleAdd = async () => {
    if (addType === 'platform') {
      await window.agentManager.addPlatform(addPlatformId, addPath)
    } else {
      const dir = await window.agentManager.openDirectory()
      if (dir) await window.agentManager.addProjectRoot(dir)
    }
    await useAppStore.getState().loadSettings()
    await refreshScan()
    setShowAdd(false)
  }

  const tabs: { id: ResourceTab; label: string; count: number }[] = [
    { id: 'skills', label: 'Skills', count: skills.length },
    { id: 'rules', label: 'Rules', count: rules.length },
    { id: 'hooks', label: 'Hooks', count: hooks.length },
    { id: 'subagents', label: 'Sub-agents', count: subAgents.length }
  ]

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h2 className="text-lg font-medium">Directories</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void refreshScan()}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 rounded"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 rounded"
          >
            <Plus size={14} /> Add Directory
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <div className="w-64 border-r border-zinc-800 flex flex-col">
          <div className="flex-1 overflow-auto p-2 border-b border-zinc-800">
            <p className="text-xs text-zinc-500 uppercase px-2 mb-2">Platforms</p>
            {settings?.platforms
              .filter((p) => p.enabled)
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelectedPlatform(p.id)
                    setSelectedProject(null)
                  }}
                  className={`w-full flex items-center gap-2 px-2 py-2 rounded text-sm ${
                    selectedPlatform === p.id ? 'bg-zinc-800' : 'hover:bg-zinc-900'
                  }`}
                >
                  <PlatformLogo platformId={p.id} size={20} />
                  <span>{PLATFORM_LABELS[p.id]}</span>
                </button>
              ))}
          </div>
          <div className="flex-1 overflow-auto p-2">
            <p className="text-xs text-zinc-500 uppercase px-2 mb-2">Projects</p>
            {settings?.projectRoots.flatMap((r) =>
              r.projects.map((proj) => (
                <button
                  key={proj.id}
                  type="button"
                  onClick={() => {
                    setSelectedProject(proj.id)
                    setSelectedPlatform(null)
                  }}
                  className={`w-full text-left px-2 py-2 rounded text-sm truncate ${
                    selectedProject === proj.id ? 'bg-zinc-800' : 'hover:bg-zinc-900'
                  }`}
                >
                  {proj.name}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex border-b border-zinc-800">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 text-sm ${tab === t.id ? 'border-b-2 border-blue-500 text-blue-400' : 'text-zinc-500'}`}
              >
                {t.label} ({t.count})
              </button>
            ))}
          </div>

          <div className="flex flex-1 min-h-0">
            <div className="w-72 border-r border-zinc-800 overflow-auto p-2">
              {!sourceId && (
                <p className="text-sm text-zinc-500 p-4">Select a platform or project</p>
              )}
              {tab === 'skills' &&
                skills.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-900 rounded cursor-pointer">
                    <input type="checkbox" defaultChecked={s.enabled} />
                    <button type="button" className="text-sm text-left flex-1" onClick={() => void handleSelectSkill(s)}>
                      {s.name}
                    </button>
                  </label>
                ))}
              {tab === 'rules' &&
                rules.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-900 rounded cursor-pointer">
                    <input type="checkbox" defaultChecked={r.enabled} />
                    <button type="button" className="text-sm text-left flex-1" onClick={() => void handleSelectRule(r)}>
                      {r.name}
                    </button>
                  </label>
                ))}
              {tab === 'hooks' &&
                hooks.map((h) => (
                  <label key={h.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-900 rounded cursor-pointer">
                    <input type="checkbox" defaultChecked={h.enabled} />
                    <button type="button" className="text-sm text-left flex-1" onClick={() => void handleSelectHook(h)}>
                      {h.name}
                    </button>
                  </label>
                ))}
              {tab === 'subagents' &&
                subAgents.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-900 rounded cursor-pointer">
                    <input type="checkbox" defaultChecked={a.enabled} />
                    <button type="button" className="text-sm text-left flex-1" onClick={() => void handleSelectSubAgent(a)}>
                      {a.name}
                    </button>
                  </label>
                ))}
            </div>

            <div className="flex-1 p-2 min-w-0">
              {selectedItem ? (
                isMarkdownFile(editorPath) ? (
                  <MarkdownEditor
                    filePath={editorPath}
                    value={editorContent}
                    onChange={setEditorContent}
                    onSave={async (v) => {
                      await window.agentManager.writeFile(editorPath, v)
                    }}
                  />
                ) : (
                  <JsonEditor
                    value={editorContent}
                    onChange={setEditorContent}
                    onSave={async (v) => {
                      await window.agentManager.writeFile(editorPath, v)
                    }}
                  />
                )
              ) : (
                <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
                  Select an item to edit
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 w-96 space-y-4">
            <h3 className="font-medium">Add Directory</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAddType('platform')}
                className={`flex-1 py-2 rounded text-sm ${addType === 'platform' ? 'bg-blue-600' : 'bg-zinc-800'}`}
              >
                Platform
              </button>
              <button
                type="button"
                onClick={() => setAddType('project')}
                className={`flex-1 py-2 rounded text-sm ${addType === 'project' ? 'bg-blue-600' : 'bg-zinc-800'}`}
              >
                Project
              </button>
            </div>
            {addType === 'platform' ? (
              <>
                <select
                  value={addPlatformId}
                  onChange={(e) => {
                    const id = e.target.value as PlatformId
                    setAddPlatformId(id)
                    setAddPath(DEFAULT_PLATFORM_ROOTS[id])
                  }}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm"
                >
                  {PLATFORM_IDS.map((id) => (
                    <option key={id} value={id}>
                      {PLATFORM_LABELS[id]}
                    </option>
                  ))}
                </select>
                <input
                  value={addPath}
                  onChange={(e) => setAddPath(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm"
                />
              </>
            ) : (
              <p className="text-sm text-zinc-400">Pick a parent folder; all subfolders with .git will be loaded.</p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm bg-zinc-800 rounded">
                Cancel
              </button>
              <button type="button" onClick={() => void handleAdd()} className="px-4 py-2 text-sm bg-blue-600 rounded">
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
