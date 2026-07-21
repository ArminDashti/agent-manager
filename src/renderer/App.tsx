import { useEffect, useRef } from 'react'

import { AppLayout } from '@renderer/components/layout/AppLayout'

import { useAppStore } from '@renderer/stores/appStore'

import { SkillsPage } from '@renderer/pages/SkillsPage'

import { RulesPage } from '@renderer/pages/RulesPage'

import { HooksPage } from '@renderer/pages/HooksPage'

import { SubAgentsPage } from '@renderer/pages/SubAgentsPage'

import { McpsPage } from '@renderer/pages/McpsPage'

import { ToolsPage } from '@renderer/pages/ToolsPage'

import { HubPage } from '@renderer/pages/HubPage'

import { SettingsPage } from '@renderer/pages/SettingsPage'

import { AboutPage } from '@renderer/pages/AboutPage'
import { InstructionsPage } from '@renderer/pages/InstructionsPage'
import { MessageModal } from '@renderer/components/MessageModal'



export default function App() {

  const { page, setPage, loadSettings, refreshScan } = useAppStore()

  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)



  useEffect(() => {

    void loadSettings()

    void refreshScan()



    const handler = (): void => {

      if (scanTimerRef.current) clearTimeout(scanTimerRef.current)

      scanTimerRef.current = setTimeout(() => {

        void refreshScan()

      }, 75)

    }

    window.addEventListener('scan-changed', handler)

    return () => {

      window.removeEventListener('scan-changed', handler)

      if (scanTimerRef.current) clearTimeout(scanTimerRef.current)

    }

  }, [loadSettings, refreshScan])



  const content = (() => {

    switch (page) {

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

      case 'instructions':

        return <InstructionsPage />

      case 'about':

        return <AboutPage />

      default:

        return <SkillsPage />

    }

  })()



  return (

    <AppLayout page={page} onNavigate={setPage}>

      <div className="flex-1 min-h-0 overflow-hidden">{content}</div>
      <MessageModal />

    </AppLayout>

  )

}


