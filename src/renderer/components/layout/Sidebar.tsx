import {
  FolderTree,
  Sparkles,
  ScrollText,
  Webhook,
  Bot,
  Plug,
  Wrench,
  CloudDownload,
  Settings,
  Info
} from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import type { PageId } from '@renderer/stores/appStore'

const nav: { id: PageId; label: string; icon: typeof FolderTree }[] = [
  { id: 'directories', label: 'Directories', icon: FolderTree },
  { id: 'skills', label: 'Skills', icon: Sparkles },
  { id: 'rules', label: 'Rules', icon: ScrollText },
  { id: 'hooks', label: 'Hooks', icon: Webhook },
  { id: 'subagents', label: 'Sub-agents', icon: Bot },
  { id: 'mcps', label: 'MCPs', icon: Plug },
  { id: 'tools', label: 'Tools', icon: Wrench },
  { id: 'hub', label: 'Hub', icon: CloudDownload },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'about', label: 'About', icon: Info }
]

interface SidebarProps {
  page: PageId
  onNavigate: (page: PageId) => void
}

export function Sidebar({ page, onNavigate }: SidebarProps) {
  return (
    <aside className="w-52 shrink-0 bg-zinc-900 border-r border-zinc-800 flex flex-col">
      <div className="px-4 py-4 border-b border-zinc-800">
        <h1 className="text-lg font-semibold text-white">Agent Manager</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Skills · Rules · MCPs</p>
      </div>
      <nav className="flex-1 p-2 space-y-0.5 overflow-auto">
        {nav.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onNavigate(id)}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
              page === id
                ? 'bg-blue-600/20 text-blue-400'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
            )}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>
    </aside>
  )
}
