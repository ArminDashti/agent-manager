import { join } from 'path'
import type { PlatformId, ResourceType } from '@shared/types'
import { CURSOR_ONLY_RESOURCES } from '@shared/types'

export interface PlatformPaths {
  skillsDirs: string[]
  rulesDir: string
  mcpConfigPath: string
  hooksConfigPath: string
  hooksScriptsDir: string
  agentsDir: string
  toolsDir: string
}

export interface PlatformAdapter {
  id: PlatformId
  label: string
  supportedResources: ResourceType[]
  getPlatformPaths(rootPath: string): PlatformPaths
  getProjectPaths(projectPath: string): PlatformPaths
}

export function getProjectDotDir(platformId: PlatformId, projectPath: string): string {
  if (platformId === 'copilot') return joinPath(projectPath, '.github')
  return joinPath(projectPath, `.${platformId}`)
}

function joinPath(...parts: string[]): string {
  return join(...parts)
}

export function createBasePaths(root: string, hooksAndAgents: boolean): PlatformPaths {
  const paths: PlatformPaths = {
    skillsDirs: [joinPath(root, 'skills')],
    rulesDir: joinPath(root, 'rules'),
    mcpConfigPath: joinPath(root, 'mcp.json'),
    hooksConfigPath: joinPath(root, 'hooks.json'),
    hooksScriptsDir: joinPath(root, 'hooks'),
    agentsDir: joinPath(root, 'agents'),
    toolsDir: joinPath(root, 'tools')
  }

  if (!hooksAndAgents) {
    paths.hooksConfigPath = ''
    paths.hooksScriptsDir = ''
    paths.agentsDir = ''
  }

  return paths
}

export function supportsResource(adapter: PlatformAdapter, type: ResourceType): boolean {
  if (CURSOR_ONLY_RESOURCES.includes(type)) {
    return adapter.id === 'cursor'
  }
  return adapter.supportedResources.includes(type)
}
