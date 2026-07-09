import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppSettings,
  AssignTarget,
  HubCatalogItem,
  HubManifest,
  HubResourceType,
  PlatformId,
  ResourceType,
  ScanResult
} from '@shared/types'

export interface AgentManagerApi {
  getAppRoot: () => Promise<string>
  getSettings: () => Promise<AppSettings>
  saveSettings: (settings: AppSettings) => Promise<AppSettings>
  resetSettings: () => Promise<AppSettings>
  getPat: () => Promise<string>
  setPat: (token: string) => Promise<boolean>
  scanAll: () => Promise<ScanResult>
  discoverProjects: (scanPath: string) => Promise<ScanResult['skills']>
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, content: string) => Promise<boolean>
  listDir: (path: string) => Promise<string[]>
  openDirectory: () => Promise<string | null>
  getAssignTargets: (resourceType: ResourceType) => Promise<AssignTarget[]>
  addPlatform: (id: PlatformId, rootPath: string) => Promise<AppSettings>
  addProjectRoot: (scanPath: string) => Promise<{ id: string; projects: unknown[] }>
  hubFetchCatalog: () => Promise<HubManifest>
  hubList: () => Promise<HubCatalogItem[]>
  hubFetchResource: (type: HubResourceType, name: string) => Promise<string>
  hubInstall: (type: HubResourceType, name: string, destDir: string) => Promise<void>
  repoBankFetch: () => Promise<string>
  repoBankCommitPush: (message: string) => Promise<void>
  getLogoPath: (platformId: string) => Promise<string | null>
}

const api: AgentManagerApi = {
  getAppRoot: () => ipcRenderer.invoke('app:getRoot'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  resetSettings: () => ipcRenderer.invoke('settings:reset'),
  getPat: () => ipcRenderer.invoke('pat:get'),
  setPat: (token) => ipcRenderer.invoke('pat:set', token),
  scanAll: () => ipcRenderer.invoke('scan:all'),
  discoverProjects: (scanPath) => ipcRenderer.invoke('scan:projects', scanPath),
  readFile: (path) => ipcRenderer.invoke('file:read', path),
  writeFile: (path, content) => ipcRenderer.invoke('file:write', path, content),
  listDir: (path) => ipcRenderer.invoke('file:listDir', path),
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  getAssignTargets: (type) => ipcRenderer.invoke('assign:targets', type),
  addPlatform: (id, rootPath) => ipcRenderer.invoke('platform:add', id, rootPath),
  addProjectRoot: (scanPath) => ipcRenderer.invoke('projectRoot:add', scanPath),
  hubFetchCatalog: () => ipcRenderer.invoke('hub:fetchCatalog'),
  hubList: () => ipcRenderer.invoke('hub:list'),
  hubFetchResource: (type, name) => ipcRenderer.invoke('hub:fetchResource', type, name),
  hubInstall: (type, name, destDir) => ipcRenderer.invoke('hub:install', type, name, destDir),
  repoBankFetch: () => ipcRenderer.invoke('repoBank:fetch'),
  repoBankCommitPush: (message) => ipcRenderer.invoke('repoBank:commitPush', message),
  getLogoPath: (platformId) => ipcRenderer.invoke('logos:getPath', platformId)
}

contextBridge.exposeInMainWorld('agentManager', api)

ipcRenderer.on('scan:changed', () => {
  window.dispatchEvent(new Event('scan-changed'))
})

declare global {
  interface Window {
    agentManager: AgentManagerApi
  }
}
