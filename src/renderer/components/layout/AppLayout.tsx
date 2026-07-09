import { Sidebar } from './Sidebar'
import type { PageId } from '@renderer/stores/appStore'

interface AppLayoutProps {
  page: PageId
  onNavigate: (page: PageId) => void
  children: React.ReactNode
}

export function AppLayout({ page, onNavigate, children }: AppLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar page={page} onNavigate={onNavigate} />
      <main className="flex-1 overflow-hidden flex flex-col bg-zinc-950">{children}</main>
    </div>
  )
}
