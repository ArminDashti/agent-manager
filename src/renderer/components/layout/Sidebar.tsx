import { useEffect, useState } from 'react'

import {
  Layers,
  FileText,
  GitBranch,
  Bot,
  Cable,
  Hammer,
  Download,
  Settings2,
  CircleHelp,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  RefreshCw
} from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { CollapsibleNavGroup } from './CollapsibleNavGroup'
import type { PageId } from '@renderer/stores/appStore'
import { useAppStore } from '@renderer/stores/appStore'

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed'

interface NavItem {
  id: PageId
  label: string
  icon: typeof Layers
}

const resourceNav: NavItem[] = [
  { id: 'skills', label: 'Skills', icon: Layers },
  { id: 'rules', label: 'Rules', icon: FileText },
  { id: 'hooks', label: 'Hooks', icon: GitBranch },
  { id: 'subagents', label: 'Sub-agents', icon: Bot },
  { id: 'mcps', label: 'MCPs', icon: Cable },
  { id: 'tools', label: 'Tools', icon: Hammer }
]

const otherNav: NavItem[] = [
  { id: 'hub', label: 'Hub', icon: Download },
  { id: 'settings', label: 'Settings', icon: Settings2 },
  { id: 'instructions', label: 'Instructions', icon: BookOpen },
  { id: 'about', label: 'About', icon: CircleHelp }
]



interface SidebarProps {

  page: PageId

  onNavigate: (page: PageId) => void

  collapsed: boolean

  onToggleCollapse: () => void

}



function NavButton({

  item,

  active,

  collapsed,

  onNavigate

}: {

  item: NavItem

  active: boolean

  collapsed: boolean

  onNavigate: (page: PageId) => void

}) {

  const Icon = item.icon

  return (

    <button

      type="button"

      title={collapsed ? item.label : undefined}

      onClick={() => onNavigate(item.id)}

      className={cn(

        'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',

        collapsed && 'justify-center px-2',

        active ? 'bg-blue-600/20 text-blue-400' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'

      )}

    >

          <Icon size={16} strokeWidth={1.75} className="shrink-0" />

      {!collapsed && <span className="truncate">{item.label}</span>}

    </button>

  )

}



export function useSidebarCollapsed(): [boolean, () => void] {

  const [collapsed, setCollapsed] = useState(() => {

    try {

      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'

    } catch {

      return false

    }

  })



  useEffect(() => {

    try {

      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed))

    } catch {

      // ignore

    }

  }, [collapsed])



  const toggle = () => setCollapsed((c) => !c)

  return [collapsed, toggle]

}



export function Sidebar({ page, onNavigate, collapsed, onToggleCollapse }: SidebarProps) {

  const { refreshScan, loadSettings } = useAppStore()
  const [refreshing, setRefreshing] = useState(false)

  const handleDeepRefresh = async () => {
    setRefreshing(true)
    try {
      await loadSettings()
      await refreshScan()
    } finally {
      setRefreshing(false)
    }
  }

  return (

    <aside

      className={cn(

        'shrink-0 bg-zinc-900 border-r border-zinc-800 flex flex-col transition-[width] duration-200',

        collapsed ? 'w-12' : 'w-52'

      )}

    >

      <div className={cn('flex items-center p-2', collapsed ? 'justify-center' : 'justify-end')}>

        <button

          type="button"

          onClick={onToggleCollapse}

          className="p-1.5 rounded-md text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"

          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}

        >

          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}

        </button>

      </div>

      <nav className="flex-1 px-2 pb-2 space-y-0.5 overflow-auto">

        <CollapsibleNavGroup label="Resources" storageKey="nav-resources-open" collapsed={collapsed}>

          {resourceNav.map((item) => (

            <NavButton

              key={item.id}

              item={item}

              active={page === item.id}

              collapsed={collapsed}

              onNavigate={onNavigate}

            />

          ))}

        </CollapsibleNavGroup>



        <CollapsibleNavGroup label="Other" storageKey="nav-other-open" collapsed={collapsed}>

          {otherNav.map((item) => (

            <NavButton

              key={item.id}

              item={item}

              active={page === item.id}

              collapsed={collapsed}

              onNavigate={onNavigate}

            />

          ))}

          <button

            type="button"

            title="Deep refresh – reload all skills, hooks, rules, settings"

            onClick={() => void handleDeepRefresh()}

            disabled={refreshing}

            className={cn(

              'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',

              collapsed && 'justify-center px-2',

              'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-40'

            )}

          >

            <RefreshCw size={16} strokeWidth={1.75} className={cn('shrink-0', refreshing && 'animate-spin')} />

            {!collapsed && <span className="truncate">Refresh all</span>}

          </button>

        </CollapsibleNavGroup>

      </nav>

    </aside>

  )

}


