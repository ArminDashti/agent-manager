export type PlatformId =
  | 'cursor'
  | 'antigravity'
  | 'codex'
  | 'copilot'
  | 'devin'
  | 'grok'

export type ResourceType =
  | 'skill'
  | 'rule'
  | 'mcp'
  | 'hook'
  | 'subAgent'
  | 'tool'

export type HubResourceType = 'skill' | 'rule' | 'mcp' | 'hook' | 'tool'

export interface ResourceSource {
  type: 'platform' | 'project' | 'hub' | 'local'
  id: string
  label: string
}

export interface PlatformConfig {
  id: PlatformId
  enabled: boolean
  rootPath: string
}

export interface ProjectInfo {
  id: string
  name: string
  path: string
  rootId: string
}

export interface ProjectRootConfig {
  id: string
  scanPath: string
  projects: ProjectInfo[]
}

export interface UiFilterState {
  search: string
  /** When true, hide resources used in exactly one project. */
  hideSingleProject: boolean
  selectedProjectId: string
  selectedCategories: string[]
  sortKey: string
  sortDir: 'asc' | 'desc'
}

export interface AppSettings {
  window: { maximized: boolean }
  startup: { runOnLogin: boolean }
  dataPath: string
  platforms: PlatformConfig[]
  projectRoots: ProjectRootConfig[]
  github: {
    pat: string
    patValid: boolean
    patValidatedAt: string | null
  }
  openRouter: {
    apiKey: string
    model: string
  }
  repoBank: {
    url: string
    localClonePath: string
    lastFetchAt: string | null
    lastPushAt: string | null
  }
  hub: {
    baseUrl: string
    catalogUrl: string
    lastFetchAt: string | null
  }
  sync: {
    enabled: boolean
    intervalMinutes: number
    lastSyncAt: string | null
  }
  uiFilters: Record<string, Partial<UiFilterState>>
  assignments: {
    skills: Record<string, string[]>
    rules: Record<string, string[]>
    mcps: Record<string, string[]>
    hooks: Record<string, string[]>
    subAgents: Record<string, string[]>
    tools: Record<string, string[]>
  }
  mandatoryForAllProjects: {
    skills: Record<string, boolean>
    rules: Record<string, boolean>
    hooks: Record<string, boolean>
    subAgents: Record<string, boolean>
    tools: Record<string, boolean>
  }
  resourceCategories: {
    skills: Record<string, string>
    rules: Record<string, string>
  }
}

export interface SkillResource {
  id: string
  name: string
  rootPath: string
  skillMdPath: string
  files: string[]
  source: ResourceSource
  enabled: boolean
}

export interface RuleResource {
  id: string
  name: string
  filePath: string
  source: ResourceSource
  enabled: boolean
}

export interface McpTool {
  name: string
  description?: string
}

export interface McpResource {
  id: string
  name: string
  owner?: string
  params: Record<string, unknown>
  tools: McpTool[]
  status: 'connected' | 'disconnected' | 'unknown' | 'error' | 'configured'
  platforms: string[]
  configPath: string
}

export interface HookDefinition {
  command?: string
  type?: 'command' | 'prompt'
  matcher?: string
  timeout?: number
  failClosed?: boolean
  loop_limit?: number
}

export interface HookResource {
  id: string
  event: string
  name: string
  configPath: string
  definition: HookDefinition
  scriptPath?: string
  scriptFiles: string[]
  source: ResourceSource
  enabled: boolean
}

export interface SubAgentResource {
  id: string
  name: string
  description: string
  filePath: string
  frontmatter: Record<string, unknown>
  source: ResourceSource
  enabled: boolean
}

export interface ToolResource {
  id: string
  name: string
  description?: string
  rootPath: string
  entrypoint?: string
  files: string[]
  source: ResourceSource
  enabled: boolean
}

export interface HubCatalogItem {
  id: string
  type: HubResourceType
  name: string
  description?: string
  tags?: string[]
  fetchUrl: string
  version?: string
}

export interface HubManifest {
  version: number
  updatedAt?: string
  skills?: string[]
  rules?: string[]
  mcps?: string[]
  hooks?: string[]
  tools?: string[]
  items?: Array<{
    type: HubResourceType
    name: string
    description?: string
    tags?: string[]
    files?: string[]
  }>
}

export interface ScanResult {
  skills: SkillResource[]
  rules: RuleResource[]
  mcps: McpResource[]
  hooks: HookResource[]
  subAgents: SubAgentResource[]
  tools: ToolResource[]
}

export interface AssignTarget {
  type: 'platform' | 'project'
  id: string
  label: string
  platformId: PlatformId
}

export interface ProjectMatrixRow {
  projectId: string
  projectName: string
  assigned: boolean
}

export interface ResourceGroupSummary {
  name: string
  usedProjectCount: number
  totalProjectCount: number
  assignedProjectIds: string[]
  tokenEstimate: number
  lastUpdatedAt: string | null
  mandatory: boolean
  canonicalId: string
  description: string
  category: string
  event?: string
}

export const PLATFORM_IDS: PlatformId[] = [
  'antigravity',
  'codex',
  'copilot',
  'cursor',
  'devin',
  'grok'
]

export const PLATFORM_LABELS: Record<PlatformId, string> = {
  antigravity: 'Antigravity',
  codex: 'Codex',
  copilot: 'Copilot',
  cursor: 'Cursor',
  devin: 'Devin',
  grok: 'Grok'
}

export const DEFAULT_PLATFORM_ROOTS: Record<PlatformId, string> = {
  antigravity: '~/.antigravity',
  codex: '~/.codex',
  copilot: '~/.copilot',
  cursor: '~/.cursor',
  devin: '~/.devin',
  grok: '~/.grok'
}

export const CURSOR_ONLY_RESOURCES: ResourceType[] = ['hook', 'subAgent']

export const PROJECT_ONLY_RESOURCES: ResourceType[] = ['skill', 'rule', 'hook', 'subAgent']
