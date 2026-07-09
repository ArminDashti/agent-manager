import { useEffect, useMemo, useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { MarkdownEditor } from '@renderer/components/MarkdownEditor'
import { useAppStore } from '@renderer/stores/appStore'
import type { HubCatalogItem, HubResourceType } from '@shared/types'
import { HUB_TYPE_FOLDERS } from '@shared/utils.browser'

const TABS: Array<{ id: HubResourceType | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'skill', label: 'Skills' },
  { id: 'rule', label: 'Rules' },
  { id: 'mcp', label: 'MCPs' },
  { id: 'hook', label: 'Hooks' },
  { id: 'tool', label: 'Tools' }
]

export function HubPage() {
  const { hubItems, setHubItems, hubFilter, setHubFilter, settings, refreshScan } = useAppStore()
  const [tab, setTab] = useState<HubResourceType | 'all'>(
    (hubFilter as HubResourceType | null) ?? 'all'
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<HubCatalogItem | null>(null)
  const [preview, setPreview] = useState('')
  const [search, setSearch] = useState('')

  const loadHub = async () => {
    setLoading(true)
    setError(null)
    try {
      const items = await window.agentManager.hubList()
      setHubItems(items)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hub not available')
      try {
        const cached = await window.agentManager.hubList()
        setHubItems(cached)
      } catch {
        setHubItems([])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (hubFilter) setTab(hubFilter as HubResourceType)
    void loadHub()
  }, [hubFilter])

  const filtered = useMemo(() => {
    let list = hubItems
    if (tab !== 'all') list = list.filter((i) => i.type === tab)
    if (search) list = list.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    return list
  }, [hubItems, tab, search])

  const previewItem = async (item: HubCatalogItem) => {
    setSelected(item)
    setLoading(true)
    try {
      const cacheDir = await window.agentManager.hubFetchResource(item.type, item.name)
      const folder = HUB_TYPE_FOLDERS[item.type]
      const tryFiles =
        item.type === 'skill'
          ? ['SKILL.md']
          : item.type === 'mcp'
            ? ['mcp.json']
            : item.type === 'hook'
              ? ['hooks.json']
              : item.type === 'rule'
                ? ['rule.mdc', 'rule.md']
                : ['README.md', 'tool.json']
      for (const f of tryFiles) {
        try {
          const content = await window.agentManager.readFile(`${cacheDir}/${f}`.replace(/\\/g, '/'))
          setPreview(content)
          return
        } catch {
          // try next
        }
      }
      setPreview('(No preview file found)')
    } finally {
      setLoading(false)
    }
  }

  const installItem = async (item: HubCatalogItem) => {
    const cursor = settings?.platforms.find((p) => p.id === 'cursor')
    if (!cursor) return
    const dest =
      item.type === 'skill'
        ? `${cursor.rootPath}/skills`
        : item.type === 'rule'
          ? `${cursor.rootPath}/rules`
          : item.type === 'mcp'
            ? `${cursor.rootPath}`
            : item.type === 'hook'
              ? `${cursor.rootPath}`
              : `${cursor.rootPath}/tools`
    await window.agentManager.hubInstall(item.type, item.name, dest)
    await refreshScan()
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div>
          <h2 className="text-lg font-medium">Hub</h2>
          <p className="text-xs text-zinc-500">{settings?.hub.baseUrl}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadHub()}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 rounded"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Fetch Hub
        </button>
      </header>

      {error && (
        <div className="mx-4 mt-2 px-3 py-2 bg-amber-900/30 border border-amber-700 rounded text-sm text-amber-200">
          {error} — showing cached catalog if available
        </div>
      )}

      <div className="flex border-b border-zinc-800 px-4 gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id)
              setHubFilter(t.id === 'all' ? null : t.id)
            }}
            className={`px-3 py-2 text-sm ${tab === t.id ? 'border-b-2 border-blue-500 text-blue-400' : 'text-zinc-500'}`}
          >
            {t.label}
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="ml-auto my-1 px-3 py-1 text-sm bg-zinc-900 border border-zinc-700 rounded"
        />
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="w-80 border-r border-zinc-800 overflow-auto">
          {filtered.length === 0 && !loading && (
            <p className="p-4 text-sm text-zinc-500">
              Hub not available — check back after GitHub Pages is live
            </p>
          )}
          {filtered.map((item) => (
            <div
              key={item.id}
              className={`px-3 py-2 border-b border-zinc-900 ${selected?.id === item.id ? 'bg-zinc-800' : ''}`}
            >
              <button type="button" className="w-full text-left" onClick={() => void previewItem(item)}>
                <div className="font-medium text-sm">{item.name}</div>
                <div className="text-xs text-zinc-500 capitalize">{item.type}</div>
              </button>
              <button
                type="button"
                onClick={() => void installItem(item)}
                className="mt-1 flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
              >
                <Download size={12} /> Install to Cursor
              </button>
            </div>
          ))}
        </div>
        <div className="flex-1 p-2 min-w-0">
          {selected ? (
            <MarkdownEditor filePath={selected.fetchUrl} value={preview} readOnly />
          ) : (
            <div className="h-full flex items-center justify-center text-zinc-500">Select a hub item to preview</div>
          )}
        </div>
      </div>
    </div>
  )
}
