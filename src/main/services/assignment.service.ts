import { copyFile, mkdir } from 'fs/promises'
import { dirname, join } from 'path'
import { existsSync } from 'fs'
import type { AppSettings, AssignTarget, ResourceType, SkillResource } from '@shared/types'
import { CURSOR_ONLY_RESOURCES } from '@shared/types'
import { fileService } from './file.service'
import { getAdapter } from '../platforms'
import { settingsStore } from './settings-store'

export class AssignmentService {
  getTargets(settings: AppSettings, resourceType: ResourceType): AssignTarget[] {
    const targets: AssignTarget[] = []

    for (const platform of settings.platforms) {
      if (!platform.enabled) continue
      if (CURSOR_ONLY_RESOURCES.includes(resourceType) && platform.id !== 'cursor') continue

      const adapter = getAdapter(platform.id)
      if (!adapter) continue

      targets.push({
        type: 'platform',
        id: platform.id,
        label: adapter.label,
        platformId: platform.id
      })
    }

    for (const root of settings.projectRoots) {
      for (const project of root.projects) {
        if (CURSOR_ONLY_RESOURCES.includes(resourceType)) {
          targets.push({
            type: 'project',
            id: project.id,
            label: `${project.name} (Cursor)`,
            platformId: 'cursor'
          })
        } else {
          for (const platform of settings.platforms) {
            if (!platform.enabled) continue
            targets.push({
              type: 'project',
              id: `${project.id}:${platform.id}`,
              label: `${project.name} (${getAdapter(platform.id)?.label ?? platform.id})`,
              platformId: platform.id
            })
          }
        }
      }
    }

    return targets
  }

  async assignSkill(skill: SkillResource, target: AssignTarget): Promise<void> {
    const adapter = getAdapter(target.platformId)
    if (!adapter) return
    const settings = settingsStore.get()
    const destRoot = this.resolvePaths(adapter, target, settings).skillsDirs[0]
    await fileService.copyDirectory(skill.rootPath, join(destRoot, skill.name))
  }

  async assignRule(rule: { filePath: string; name: string }, target: AssignTarget): Promise<void> {
    const adapter = getAdapter(target.platformId)
    if (!adapter) return
    const settings = settingsStore.get()
    const paths = this.resolvePaths(adapter, target, settings)
    await mkdir(paths.rulesDir, { recursive: true })
    await copyFile(rule.filePath, join(paths.rulesDir, rule.name))
  }

  async assignMcp(
    mcp: { name: string; params: Record<string, unknown> },
    target: AssignTarget
  ): Promise<void> {
    const adapter = getAdapter(target.platformId)
    if (!adapter) return
    const settings = settingsStore.get()
    const paths = this.resolvePaths(adapter, target, settings)

    let config: { mcpServers?: Record<string, unknown> } = { mcpServers: {} }
    if (existsSync(paths.mcpConfigPath)) {
      config = JSON.parse(await fileService.readText(paths.mcpConfigPath))
    }
    config.mcpServers ??= {}
    config.mcpServers[mcp.name] = mcp.params
    await fileService.writeText(paths.mcpConfigPath, JSON.stringify(config, null, 2))
  }

  private resolvePaths(
    adapter: ReturnType<typeof getAdapter>,
    target: AssignTarget,
    settings: AppSettings
  ) {
    if (!adapter) throw new Error('No adapter')
    if (target.type === 'platform') {
      const platform = settings.platforms.find((p) => p.id === target.platformId)!
      return adapter.getPlatformPaths(platform.rootPath)
    }
    const projectId = target.id.includes(':') ? target.id.split(':')[0] : target.id
    const project = settings.projectRoots
      .flatMap((r) => r.projects)
      .find((p) => p.id === projectId)
    if (!project) throw new Error('Project not found')
    return adapter.getProjectPaths(project.path)
  }
}

export const assignmentService = new AssignmentService()
