import { create } from 'zustand'
import type { AppSettings, HubCatalogItem, ScanResult } from '@shared/types'

export type PageId =
  | 'directories'
  | 'skills'
  | 'rules'
  | 'hooks'
  | 'subagents'
  | 'mcps'
  | 'tools'
  | 'hub'
  | 'settings'
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
  searchQuery: string
  setSearchQuery: (q: string) => void
  refreshScan: () => Promise<void>
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
  page: 'directories',
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
  searchQuery: '',
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  loadSettings: async () => {
    const settings = await window.agentManager.getSettings()
    set({ settings })
  },
  refreshScan: async () => {
    set({ loading: true })
    try {
      const scan = await window.agentManager.scanAll()
      set({ scan })
    } finally {
      set({ loading: false })
    }
  }
}))

export { emptyScan }
