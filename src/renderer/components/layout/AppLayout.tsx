import { Sidebar, useSidebarCollapsed } from './Sidebar'

import { TitleBar } from './TitleBar'

import type { PageId } from '@renderer/stores/appStore'



interface AppLayoutProps {

  page: PageId

  onNavigate: (page: PageId) => void

  children: React.ReactNode

}



export function AppLayout({ page, onNavigate, children }: AppLayoutProps) {

  const [sidebarCollapsed, toggleSidebar] = useSidebarCollapsed()



  return (

    <div className="flex flex-col h-screen overflow-hidden">

      <TitleBar />

      <div className="flex flex-1 min-h-0">

        <Sidebar

          page={page}

          onNavigate={onNavigate}

          collapsed={sidebarCollapsed}

          onToggleCollapse={toggleSidebar}

        />

        <main className="flex-1 min-h-0 overflow-hidden flex flex-col bg-zinc-950">{children}</main>

      </div>

    </div>

  )

}


