import { useEffect } from 'react'
import { AppLayout } from '@renderer/components/layout/AppLayout'
import { useAppStore } from '@renderer/stores/appStore'
import { DirectoriesPage } from '@renderer/pages/DirectoriesPage'
import { SkillsPage } from '@renderer/pages/SkillsPage'
import { RulesPage } from '@renderer/pages/RulesPage'
import { HooksPage } from '@renderer/pages/HooksPage'
import { SubAgentsPage } from '@renderer/pages/SubAgentsPage'
import { McpsPage } from '@renderer/pages/McpsPage'
import { ToolsPage } from '@renderer/pages/ToolsPage'
import { HubPage } from '@renderer/pages/HubPage'
import { SettingsPage } from '@renderer/pages/SettingsPage'
import { AboutPage } from '@renderer/pages/AboutPage'

function GlobalSearch() {
  const { searchQuery, setSearchQuery } = useAppStore()
  return (
    <div className="px-4 py-2 border-b border-zinc-800">
      <input
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search resources…"
        className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm"
      />
    </div>
  )
}

export default function App() {
  const { page, setPage, loadSettings, refreshScan } = useAppStore()

  useEffect(() => {
    void loadSettings()
    void refreshScan()

    const handler = (): void => {
      void refreshScan()
    }
    window.addEventListener('scan-changed', handler)
    return () => window.removeEventListener('scan-changed', handler)
  }, [loadSettings, refreshScan])

  const content = (() => {
    switch (page) {
      case 'directories':
        return <DirectoriesPage />
      case 'skills':
        return <SkillsPage />
      case 'rules':
        return <RulesPage />
      case 'hooks':
        return <HooksPage />
      case 'subagents':
        return <SubAgentsPage />
      case 'mcps':
        return <McpsPage />
      case 'tools':
        return <ToolsPage />
      case 'hub':
        return <HubPage />
      case 'settings':
        return <SettingsPage />
      case 'about':
        return <AboutPage />
      default:
        return <DirectoriesPage />
    }
  })()

  return (
    <AppLayout page={page} onNavigate={setPage}>
      {page !== 'settings' && page !== 'about' && <GlobalSearch />}
      <div className="flex-1 min-h-0 overflow-hidden">{content}</div>
    </AppLayout>
  )
}
