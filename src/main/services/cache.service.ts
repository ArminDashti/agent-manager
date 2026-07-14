import { copyFile } from 'fs/promises'
import { basename, join } from 'path'
import { existsSync } from 'fs'
import type {
  HookResource,
  RuleResource,
  ScanResult,
  SkillResource,
  SubAgentResource
} from '@shared/types'
import { ruleDisplayName } from '@shared/rule-names'
import { getCachesPath } from '../app-paths'
import type { PlatformPaths } from '../platforms/types'
import { createBasePaths } from '../platforms/types'
import { fileService } from './file.service'
import { scannerService } from './scanner.service'
import { settingsStore } from './settings-store'

type CacheableType = 'skill' | 'rule' | 'hook' | 'subAgent'
type CacheableResource = SkillResource | RuleResource | HookResource | SubAgentResource

export class CacheService {
  getCachePaths(): PlatformPaths {
    const root = getCachesPath()
    const paths = createBasePaths(root, true)
    paths.hooksConfigPath = join(root, 'hooks', 'hooks.json')
    paths.hooksScriptsDir = join(root, 'hooks', 'hooks')
    paths.mcpConfigPath = ''
    paths.toolsDir = ''
    return paths
  }

  async cacheResourcesFromProjects(projectIds: string[]): Promise<void> {
    if (projectIds.length === 0) return

    const settings = settingsStore.get()
    const scan = await scannerService.scanAll(settings)
    const projectIdSet = new Set(projectIds)

    await this.cacheFromScan(scan, projectIdSet)
  }

  async cacheFromScan(scan: ScanResult, projectIds?: Set<string>): Promise<void> {
    const byType: Record<CacheableType, Map<string, CacheableResource>> = {
      skill: new Map(),
      rule: new Map(),
      hook: new Map(),
      subAgent: new Map()
    }

    const include = (projectId: string) => !projectIds || projectIds.has(projectId)

    for (const skill of scan.skills) {
      if (skill.source.type !== 'project' || !include(skill.source.id)) continue
      this.upsertPreferCursor(byType.skill, skill.name, skill)
    }

    for (const rule of scan.rules) {
      if (rule.source.type !== 'project' || !include(rule.source.id)) continue
      const key = ruleDisplayName(rule.name)
      this.upsertPreferCursor(byType.rule, key, rule)
    }

    for (const hook of scan.hooks) {
      if (hook.source.type !== 'project' || !include(hook.source.id)) continue
      this.upsertPreferCursor(byType.hook, hook.name, hook)
    }

    for (const agent of scan.subAgents) {
      if (agent.source.type !== 'project' || !include(agent.source.id)) continue
      this.upsertPreferCursor(byType.subAgent, agent.name, agent)
    }

    for (const [type, map] of Object.entries(byType) as Array<[CacheableType, Map<string, CacheableResource>]>) {
      for (const item of map.values()) {
        await this.cacheResourceFromScan(item, type)
      }
    }
  }

  async cacheResourceFromScan(
    item: CacheableResource,
    resourceType: CacheableType
  ): Promise<void> {
    switch (resourceType) {
      case 'skill': {
        const skill = item as SkillResource
        const dest = join(getCachesPath(), 'skills', skill.name)
        await fileService.copyDirectory(skill.rootPath, dest)
        break
      }
      case 'rule': {
        const rule = item as RuleResource
        const destDir = join(getCachesPath(), 'rules')
        await fileService.writeText(join(destDir, '.keep'), '')
        const destFile = join(destDir, basename(rule.filePath))
        if (!existsSync(destFile)) {
          await copyFile(rule.filePath, destFile)
        }
        break
      }
      case 'subAgent': {
        const agent = item as SubAgentResource
        const destDir = join(getCachesPath(), 'agents')
        await fileService.writeText(join(destDir, '.keep'), '')
        const destFile = join(destDir, basename(agent.filePath))
        if (!existsSync(destFile)) {
          await copyFile(agent.filePath, destFile)
        }
        break
      }
      case 'hook': {
        const hook = item as HookResource
        await this.cacheHook(hook)
        break
      }
    }
  }

  private async cacheHook(hook: HookResource): Promise<void> {
    const hooksConfigPath = join(getCachesPath(), 'hooks', 'hooks.json')
    const hooksScriptsDir = join(getCachesPath(), 'hooks', 'hooks')

    let config: { hooks?: Record<string, Array<Record<string, unknown>>> } = { hooks: {} }
    if (existsSync(hooksConfigPath)) {
      config = JSON.parse(await fileService.readText(hooksConfigPath))
    }
    config.hooks ??= {}
    const entries = config.hooks[hook.event] ?? []
    const command = String(hook.definition.command ?? '')
    const exists = entries.some((e) => String(e.command ?? '') === command)
    if (!exists) {
      entries.push({ ...hook.definition })
      config.hooks[hook.event] = entries
    }
    await fileService.writeText(hooksConfigPath, JSON.stringify(config, null, 2))

    if (hook.scriptPath && existsSync(hook.scriptPath)) {
      await fileService.writeText(join(hooksScriptsDir, '.keep'), '')
      const dest = join(hooksScriptsDir, basename(hook.scriptPath))
      if (!existsSync(dest)) {
        await copyFile(hook.scriptPath, dest)
      }
    }
  }

  async writeSkill(name: string, content: string): Promise<void> {
    const skillDir = join(getCachesPath(), 'skills', name)
    await fileService.writeText(join(skillDir, 'SKILL.md'), content)
  }

  async writeRule(name: string, content: string): Promise<void> {
    await fileService.writeText(join(getCachesPath(), 'rules', `${name}.mdc`), content)
  }

  async writeSubAgent(name: string, content: string): Promise<void> {
    await fileService.writeText(join(getCachesPath(), 'agents', `${name}.md`), content)
  }

  async appendHook(name: string): Promise<void> {
    const hooksPath = join(getCachesPath(), 'hooks', 'hooks.json')
    let config: { hooks?: Record<string, Array<Record<string, unknown>>> } = { hooks: {} }
    if (existsSync(hooksPath)) {
      config = JSON.parse(await fileService.readText(hooksPath))
    }
    config.hooks ??= {}
    const event = 'beforeSubmitPrompt'
    const entries = config.hooks[event] ?? []
    entries.push({ command: `hooks/${name}.sh`, type: 'command' })
    config.hooks[event] = entries
    await fileService.writeText(hooksPath, JSON.stringify(config, null, 2))
    const scriptPath = join(getCachesPath(), 'hooks', 'hooks', `${name}.sh`)
    if (!existsSync(scriptPath)) {
      await fileService.writeText(scriptPath, '#!/bin/sh\necho "hook"\n')
    }
  }

  async installFromHubCache(
    type: 'skill' | 'rule' | 'hook',
    name: string,
    hubCacheDir: string
  ): Promise<void> {
    switch (type) {
      case 'skill':
        await fileService.copyDirectory(hubCacheDir, join(getCachesPath(), 'skills', name))
        break
      case 'rule': {
        const candidates = ['rule.mdc', 'rule.md', `${name}.mdc`, `${name}.md`]
        for (const file of candidates) {
          const src = join(hubCacheDir, file)
          if (existsSync(src)) {
            await copyFile(src, join(getCachesPath(), 'rules', basename(file)))
            return
          }
        }
        break
      }
      case 'hook': {
        const src = join(hubCacheDir, 'hooks.json')
        if (existsSync(src)) {
          const dest = join(getCachesPath(), 'hooks', 'hooks.json')
          if (existsSync(dest)) {
            const existing = JSON.parse(await fileService.readText(dest)) as {
              hooks?: Record<string, Array<Record<string, unknown>>>
            }
            const incoming = JSON.parse(await fileService.readText(src)) as {
              hooks?: Record<string, Array<Record<string, unknown>>>
            }
            existing.hooks ??= {}
            for (const [event, entries] of Object.entries(incoming.hooks ?? {})) {
              const current = existing.hooks[event] ?? []
              for (const entry of entries) {
                const cmd = String(entry.command ?? '')
                if (!current.some((e) => String(e.command ?? '') === cmd)) {
                  current.push(entry)
                }
              }
              existing.hooks[event] = current
            }
            await fileService.writeText(dest, JSON.stringify(existing, null, 2))
          } else {
            await copyFile(src, dest)
          }
        }
        const hooksDir = join(hubCacheDir, 'hooks')
        if (existsSync(hooksDir)) {
          await fileService.copyDirectory(hooksDir, join(getCachesPath(), 'hooks', 'hooks'))
        }
        break
      }
    }
  }

  private upsertPreferCursor<T extends { source: { label: string } }>(
    map: Map<string, T>,
    key: string,
    item: T
  ): void {
    const existing = map.get(key)
    if (!existing) {
      map.set(key, item)
      return
    }
    if (item.source.label.includes('Cursor') && !existing.source.label.includes('Cursor')) {
      map.set(key, item)
    }
  }
}

export const cacheService = new CacheService()
