import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppSettings,
  AssignTarget,
  HubCatalogItem,
  HubManifest,
  HubResourceType,
  PlatformId,
  ProjectMatrixRow,
  ResourceGroupSummary,
  ResourceType,
  ScanResult,
  HookResource,
  RuleResource,
  SkillResource,
  SubAgentResource,
  ToolResource
} from '@shared/types'

export interface AgentManagerApi {
  getAppRoot: () => Promise<string>
  getSettings: () => Promise<AppSettings>
  saveSettings: (settings: AppSettings) => Promise<AppSettings>
  resetSettings: () => Promise<AppSettings>
  validatePat: (pat: string) => Promise<{ valid: boolean; login?: string }>
  scanAll: () => Promise<ScanResult>
  discoverProjects: (scanPath: string) => Promise<ScanResult['skills']>
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, content: string) => Promise<boolean>
  listDir: (path: string) => Promise<string[]>
  listEntries: (path: string) => Promise<{ path: string; name: string; isDirectory: boolean }[]>
  openDirectory: () => Promise<string | null>
  openDirectories: () => Promise<string[]>
  getAssignTargets: (resourceType: ResourceType) => Promise<AssignTarget[]>
  getResourceStats: (resourceType: Exclude<ResourceType, 'mcp'>) => Promise<ResourceGroupSummary[]>
  getProjectMatrix: (
    resourceType: Exclude<ResourceType, 'mcp'>,
    resourceName: string
  ) => Promise<ProjectMatrixRow[]>
  applyProjectAssignment: (
    resourceType: Exclude<ResourceType, 'mcp'>,
    resourceName: string,
    assignedProjectIds: string[]
  ) => Promise<boolean>
  setMandatory: (
    resourceType: Exclude<ResourceType, 'mcp'>,
    resourceName: string,
    mandatory: boolean
  ) => Promise<boolean>
  setResourceCategory: (
    resourceType: 'skill' | 'rule',
    resourceName: string,
    category: string
  ) => Promise<boolean>
  renameResource: (
    resourceType: 'skill' | 'rule' | 'hook' | 'subAgent',
    oldName: string,
    newName: string
  ) => Promise<boolean>
  deleteResource: (resourceType: Exclude<ResourceType, 'mcp'>, resourceName: string) => Promise<boolean>
  createResource: (
    resourceType: 'skill' | 'rule' | 'hook' | 'subAgent',
    name: string,
    projectIds: string[]
  ) => Promise<boolean>
  getCanonicalResource: (
    resourceType: Exclude<ResourceType, 'mcp'>,
    resourceName: string
  ) => Promise<SkillResource | RuleResource | HookResource | SubAgentResource | ToolResource | null>
  deleteMcp: (name: string, configPath: string) => Promise<boolean>
  addMcp: (name: string, params: Record<string, unknown>) => Promise<string>
  addPlatform: (id: PlatformId, rootPath: string) => Promise<AppSettings>
  addProjectRoot: (scanPath: string) => Promise<{ id: string; projects: unknown[] }>
  importProjects: (paths: string[]) => Promise<{ imported: number; projects: unknown[] }>
  removeProject: (projectId: string) => Promise<boolean>
  hubFetchCatalog: () => Promise<HubManifest>
  hubList: () => Promise<HubCatalogItem[]>
  hubFetchResource: (type: HubResourceType, name: string) => Promise<string>
  hubInstall: (type: HubResourceType, name: string, destDir: string) => Promise<void>
  repoBankFetch: () => Promise<string>
  repoBankCommitPush: (message: string) => Promise<void>
  getLogoPath: (platformId: string) => Promise<string | null>
  minimizeWindow: () => Promise<boolean>
  maximizeWindow: () => Promise<boolean>
  closeWindow: () => Promise<boolean>
  isWindowMaximized: () => Promise<boolean>
}

const api: AgentManagerApi = {
  getAppRoot: () => ipcRenderer.invoke('app:getRoot'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  resetSettings: () => ipcRenderer.invoke('settings:reset'),
  validatePat: (pat) => ipcRenderer.invoke('github:validatePat', pat),
  scanAll: () => ipcRenderer.invoke('scan:all'),
  discoverProjects: (scanPath) => ipcRenderer.invoke('scan:projects', scanPath),
  readFile: (path) => ipcRenderer.invoke('file:read', path),
  writeFile: (path, content) => ipcRenderer.invoke('file:write', path, content),
  listDir: (path) => ipcRenderer.invoke('file:listDir', path),
  listEntries: (path) => ipcRenderer.invoke('file:listEntries', path),
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  openDirectories: () => ipcRenderer.invoke('dialog:openDirectories'),
  getAssignTargets: (type) => ipcRenderer.invoke('assign:targets', type),
  getResourceStats: (type) => ipcRenderer.invoke('resource:stats', type),
  getProjectMatrix: (type, name) => ipcRenderer.invoke('assign:getProjectMatrix', type, name),
  applyProjectAssignment: (type, name, ids) =>
    ipcRenderer.invoke('assign:apply', type, name, ids),
  setMandatory: (type, name, mandatory) =>
    ipcRenderer.invoke('assign:setMandatory', type, name, mandatory),
  setResourceCategory: (type, name, category) =>
    ipcRenderer.invoke('resource:setCategory', type, name, category),
  renameResource: (type, oldName, newName) =>
    ipcRenderer.invoke('resource:rename', type, oldName, newName),
  deleteResource: (type, name) => ipcRenderer.invoke('resource:delete', type, name),
  createResource: (type, name, ids) => ipcRenderer.invoke('resource:create', type, name, ids),
  getCanonicalResource: (type, name) => ipcRenderer.invoke('resource:getCanonical', type, name),
  deleteMcp: (name, configPath) => ipcRenderer.invoke('mcp:delete', name, configPath),
  addMcp: (name, params) => ipcRenderer.invoke('mcp:add', name, params),
  addPlatform: (id, rootPath) => ipcRenderer.invoke('platform:add', id, rootPath),
  addProjectRoot: (scanPath) => ipcRenderer.invoke('projectRoot:add', scanPath),
  importProjects: (paths) => ipcRenderer.invoke('projects:import', paths),
  removeProject: (projectId) => ipcRenderer.invoke('projects:remove', projectId),
  hubFetchCatalog: () => ipcRenderer.invoke('hub:fetchCatalog'),
  hubList: () => ipcRenderer.invoke('hub:list'),
  hubFetchResource: (type, name) => ipcRenderer.invoke('hub:fetchResource', type, name),
  hubInstall: (type, name, destDir) => ipcRenderer.invoke('hub:install', type, name, destDir),
  repoBankFetch: () => ipcRenderer.invoke('repoBank:fetch'),
  repoBankCommitPush: (message) => ipcRenderer.invoke('repoBank:commitPush', message),
  getLogoPath: (platformId) => ipcRenderer.invoke('logos:getPath', platformId),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isWindowMaximized: () => ipcRenderer.invoke('window:isMaximized')
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
