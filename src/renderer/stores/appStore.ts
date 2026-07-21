import { create } from 'zustand'
import type { AppSettings, HubCatalogItem, ScanResult } from '@shared/types'

export type PageId =
  | 'skills'
  | 'rules'
  | 'hooks'
  | 'subagents'
  | 'mcps'
  | 'tools'
  | 'hub'
  | 'settings'
  | 'instructions'
  | 'about'

interface AppState {
  page: PageId
  setPage: (page: PageId) => void
  hubFilter: string | null
  setHubFilter: (filter: string | null) => void
  settings: AppSettings | null
  setSettings: (settings: AppSettings) => void
  scan: ScanResult | null
  setScan: (scan: ScanResult) => void
  hubItems: HubCatalogItem[]
  setHubItems: (items: HubCatalogItem[]) => void
  loading: boolean
  setLoading: (loading: boolean) => void
  refreshScan: (options?: { probeMcps?: boolean }) => Promise<void>
  loadSettings: () => Promise<void>
}

const emptyScan: ScanResult = {
  skills: [],
  rules: [],
  mcps: [],
  hooks: [],
  subAgents: [],
  tools: []
}

export const useAppStore = create<AppState>((set, get) => ({
  page: 'skills',
  setPage: (page) => set({ page }),
  hubFilter: null,
  setHubFilter: (hubFilter) => set({ hubFilter }),
  settings: null,
  setSettings: (settings) => set({ settings }),
  scan: null,
  setScan: (scan) => set({ scan }),
  hubItems: [],
  setHubItems: (hubItems) => set({ hubItems }),
  loading: false,
  setLoading: (loading) => set({ loading }),
  loadSettings: async () => {
    const settings = await window.agentManager.getSettings()
    set({ settings })
  },
  refreshScan: async (options) => {
    // #region agent log
    const startedAt = Date.now()
    fetch('http://127.0.0.1:7919/ingest/7067de5c-1d6a-4e66-b02e-a794cb173e15',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'082fb2'},body:JSON.stringify({sessionId:'082fb2',location:'appStore.ts:refreshScan',message:'refreshScan started',data:{probeMcps:options?.probeMcps===true,runId:'post-fix'},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{})
    // #endregion
    // Soft-refresh: only flash global loading on the first scan (no existing data)
    const isInitial = get().scan == null
    if (isInitial) set({ loading: true })
    try {
      const scan = await window.agentManager.scanAll(options)
      set({ scan })
      // #region agent log
      fetch('http://127.0.0.1:7919/ingest/7067de5c-1d6a-4e66-b02e-a794cb173e15',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'082fb2'},body:JSON.stringify({sessionId:'082fb2',location:'appStore.ts:refreshScan:done',message:'refreshScan done',data:{durationMs:Date.now()-startedAt,skills:scan.skills.length,mcps:scan.mcps.length,probeMcps:options?.probeMcps===true,runId:'post-fix'},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{})
      // #endregion
    } finally {
      if (isInitial) set({ loading: false })
    }
  }
}))

export { emptyScan }
