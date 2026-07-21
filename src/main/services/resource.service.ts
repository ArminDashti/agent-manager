import { existsSync } from 'fs'
import { basename, dirname, join } from 'path'
import type {
  AppSettings,
  HookResource,
  ProjectInfo,
  ProjectMatrixRow,
  ResourceGroupSummary,
  ResourceType,
  RuleResource,
  ScanResult,
  SkillResource,
  SubAgentResource,
  ToolResource
} from '@shared/types'
import { CURSOR_ONLY_RESOURCES } from '@shared/types'
import { ruleBaseName, ruleDisplayName, ruleMatchesDisplayName } from '@shared/rule-names'
import { isValidResourceName } from '@shared/resource-names'
import { parseFrontmatter, defaultCategoryFromName, parseSkillGroupKey, skillContentHash, skillFolderNameFromKey, skillGroupKey } from '@shared/utils'
import { fileService, type TrashResourceKind } from './file.service'
import { assignmentService } from './assignment.service'
import { scannerService } from './scanner.service'
import { settingsStore } from './settings-store'
import { categoriesStore } from './categories-store'
import { repoBankService } from './repo-bank.service'
import { withQuietWatch } from './watcher.service'
import { withSkillSyncPaused } from './skill-sync.service'
import { getAdapter } from '../platforms'
import { agentDebugLog } from './debug-log'
import type { PlatformPaths } from '../platforms/types'

type ScannedResource =
  | SkillResource
  | RuleResource
  | HookResource
  | SubAgentResource
  | ToolResource

const ASSIGNMENT_KEY: Record<
  Exclude<ResourceType, 'mcp'>,
  keyof AppSettings['assignments']
> = {
  skill: 'skills',
  rule: 'rules',
  hook: 'hooks',
  subAgent: 'subAgents',
  tool: 'tools'
}

const MANDATORY_KEY: Record<
  Exclude<ResourceType, 'mcp'>,
  keyof AppSettings['mandatoryForAllProjects']
> = {
  skill: 'skills',
  rule: 'rules',
  hook: 'hooks',
  subAgent: 'subAgents',
  tool: 'tools'
}

function getItems(scan: ScanResult, resourceType: ResourceType): ScannedResource[] {
  switch (resourceType) {
    case 'skill':
      return scan.skills
    case 'rule':
      return scan.rules
    case 'hook':
      return scan.hooks
    case 'subAgent':
      return scan.subAgents
    case 'tool':
      return scan.tools
    default:
      return []
  }
}

function isCursorInstance(item: ScannedResource): boolean {
  return item.source.label.includes('Cursor') || item.source.id === 'cursor'
}

function filterItems(items: ScannedResource[], resourceType: ResourceType): ScannedResource[] {
  if (CURSOR_ONLY_RESOURCES.includes(resourceType)) {
    return items.filter(isCursorInstance)
  }
  return items
}

const CATEGORY_KEY: Record<'skill' | 'rule', keyof AppSettings['resourceCategories']> = {
  skill: 'skills',
  rule: 'rules'
}

function groupKey(item: ScannedResource, resourceType: ResourceType): string {
  if (resourceType === 'rule') {
    return ruleDisplayName((item as RuleResource).name)
  }
  if (resourceType === 'skill') {
    const skill = item as SkillResource
    return skillGroupKey(skill.name, skill.contentHash)
  }
  return item.name
}

function matchesResourceName(
  item: ScannedResource,
  resourceType: ResourceType,
  resourceName: string
): boolean {
  if (resourceType === 'rule') {
    return ruleMatchesDisplayName((item as RuleResource).name, resourceName)
  }
  if (resourceType === 'skill') {
    const skill = item as SkillResource
    const parsed = parseSkillGroupKey(resourceName)
    if (parsed) {
      return skill.name === parsed.name && skill.contentHash === parsed.contentHash
    }
    return skill.name === resourceName
  }
  return item.name === resourceName
}

function groupByName(
  items: ScannedResource[],
  resourceType: ResourceType
): Map<string, ScannedResource[]> {
  const map = new Map<string, ScannedResource[]>()
  for (const item of items) {
    const key = groupKey(item, resourceType)
    const list = map.get(key) ?? []
    list.push(item)
    map.set(key, list)
  }
  return map
}

function pickCanonical(instances: ScannedResource[]): ScannedResource {
  const project = instances.find((i) => i.source.type === 'project')
  if (project) return project
  const local = instances.find((i) => i.source.type === 'local')
  return local ?? instances[0]
}

function collectAssignedProjectIds(instances: ScannedResource[]): string[] {
  const projectIds = new Set<string>()
  for (const item of instances) {
    if (item.source.type === 'project') {
      projectIds.add(item.source.id)
    }
  }
  return [...projectIds]
}

function countProjectsUsing(instances: ScannedResource[]): number {
  const projectIds = new Set<string>()
  for (const item of instances) {
    if (item.source.type === 'project') {
      projectIds.add(item.source.id)
    }
  }
  return projectIds.size
}

function getAllProjects(settings: AppSettings) {
  return settings.projectRoots.flatMap((r) => r.projects)
}

function trashKind(resourceType: Exclude<ResourceType, 'mcp'>): TrashResourceKind {
  switch (resourceType) {
    case 'skill':
      return 'skills'
    case 'rule':
      return 'rules'
    case 'hook':
      return 'hooks'
    case 'subAgent':
      return 'subAgents'
    case 'tool':
      return 'tools'
  }
}

async function withInAppFsOp<T>(fn: () => Promise<T>): Promise<T> {
  return withQuietWatch(() => withSkillSyncPaused(fn))
}

function* iterateProjectPlatformPaths(settings: AppSettings): Generator<{
  project: ProjectInfo
  paths: PlatformPaths
  platformId: string
}> {
  for (const project of getAllProjects(settings)) {
    for (const platform of settings.platforms) {
      if (!platform.enabled) continue
      const adapter = getAdapter(platform.id)
      if (!adapter) continue
      yield { project, paths: adapter.getProjectPaths(project.path), platformId: platform.id }
    }
  }
}

async function estimateTokens(item: ScannedResource, resourceType: ResourceType): Promise<number> {
  let path: string | undefined
  switch (resourceType) {
    case 'skill': {
      const s = item as SkillResource
      path = s.skillMdPath
      break
    }
    case 'rule':
      path = (item as RuleResource).filePath
      break
    case 'hook': {
      const h = item as HookResource
      path = h.scriptPath ?? h.configPath
      break
    }
    case 'subAgent':
      path = (item as SubAgentResource).filePath
      break
    case 'tool': {
      const t = item as ToolResource
      path = t.entrypoint
        ? join(t.rootPath, t.entrypoint)
        : (t.files.find((f) => f.endsWith('tool.json')) ?? t.files[0])
      break
    }
    default:
      return 0
  }
  if (!path || !existsSync(path)) return 0
  try {
    const text = await fileService.readText(path)
    return Math.ceil(text.length / 4)
  } catch {
    return 0
  }
}

async function getLastUpdated(item: ScannedResource, resourceType: ResourceType): Promise<string | null> {
  let path: string
  switch (resourceType) {
    case 'skill':
      path = (item as SkillResource).rootPath
      break
    case 'rule':
      path = (item as RuleResource).filePath
      break
    case 'hook':
      path = (item as HookResource).configPath
      break
    case 'subAgent':
      path = (item as SubAgentResource).filePath
      break
    case 'tool':
      path = (item as ToolResource).rootPath
      break
    default:
      return null
  }
  try {
    const mtime = await fileService.getMtime(path)
    return mtime ? new Date(mtime).toISOString() : null
  } catch {
    return null
  }
}

async function extractDescription(
  item: ScannedResource,
  resourceType: ResourceType
): Promise<string> {
  let path: string | undefined
  if (resourceType === 'skill') {
    path = (item as SkillResource).skillMdPath
  } else if (resourceType === 'rule') {
    path = (item as RuleResource).filePath
  } else if (resourceType === 'subAgent') {
    path = (item as SubAgentResource).filePath
  } else {
    return ''
  }
  if (!path || !existsSync(path)) return ''
  try {
    const text = await fileService.readText(path)
    const { frontmatter } = parseFrontmatter(text)
    return String(frontmatter.description ?? '').trim()
  } catch {
    return ''
  }
}

export class ResourceService {
  async getGroupSummaries(
    scan: ScanResult,
    settings: AppSettings,
    resourceType: Exclude<ResourceType, 'mcp'>
  ): Promise<ResourceGroupSummary[]> {
    // #region agent log
    const startedAt = Date.now()
    // #endregion
    const items = filterItems(getItems(scan, resourceType), resourceType)
    const grouped = groupByName(items, resourceType)
    const totalProjects = getAllProjects(settings).length
    const mandatoryKey = MANDATORY_KEY[resourceType]
    const mandatoryMap = settings.mandatoryForAllProjects?.[mandatoryKey] ?? {}
    const categoryMap =
      resourceType === 'skill' || resourceType === 'rule'
        ? (settings.resourceCategories?.[CATEGORY_KEY[resourceType]] ?? {})
        : {}

    const summaries: ResourceGroupSummary[] = []
    const categoriesToPersist: Record<string, string> = {}

    for (const [key, instances] of grouped) {
      const canonical = pickCanonical(instances)
      const displayName = canonical.name
      const [tokens, description, ...mtimes] = await Promise.all([
        estimateTokens(canonical, resourceType),
        resourceType === 'skill' || resourceType === 'rule' || resourceType === 'subAgent'
          ? extractDescription(canonical, resourceType)
          : Promise.resolve(''),
        ...instances.map((i) => getLastUpdated(i, resourceType))
      ])
      const lastUpdatedAt = mtimes
        .filter((m): m is string => m !== null)
        .sort()
        .pop() ?? null

      let category = ''
      if (resourceType === 'skill' || resourceType === 'rule') {
        const catMap = categoryMap as Record<string, string>
        category = catMap[key] ?? catMap[displayName] ?? ''
      }
      if (resourceType === 'skill' && !category.trim()) {
        const derived = defaultCategoryFromName(displayName)
        if (derived) {
          category = derived
          categoriesToPersist[displayName] = derived
        }
      }

      const mandatoryRecord = mandatoryMap as Record<string, boolean>
      const mandatory = mandatoryRecord[key] ?? mandatoryRecord[displayName] ?? false

      summaries.push({
        name: displayName,
        groupKey: key,
        contentHash:
          resourceType === 'skill' ? (canonical as SkillResource).contentHash : undefined,
        usedProjectCount: countProjectsUsing(instances),
        totalProjectCount: totalProjects,
        assignedProjectIds: collectAssignedProjectIds(instances),
        tokenEstimate: tokens,
        lastUpdatedAt,
        mandatory,
        canonicalId: canonical.id,
        description,
        category,
        event:
          resourceType === 'hook'
            ? (canonical as HookResource).event
            : undefined
      })
    }

    if (resourceType === 'skill' && Object.keys(categoriesToPersist).length > 0) {
      categoriesStore.mergeDerivedSkills(categoriesToPersist)
    }

    const sorted = summaries.sort((a, b) => a.name.localeCompare(b.name))
    // #region agent log
    const sourceCounts = { project: 0, local: 0, platform: 0, other: 0 }
    for (const item of items) {
      const t = item.source?.type
      if (t === 'project') sourceCounts.project++
      else if (t === 'local') sourceCounts.local++
      else if (t === 'platform') sourceCounts.platform++
      else sourceCounts.other++
    }
    agentDebugLog('A', 'resource.service.ts:getGroupSummaries', 'summaries built', {
      resourceType,
      groupCount: grouped.size,
      itemCount: items.length,
      summaryCount: sorted.length,
      sourceCounts,
      firstNames: sorted.slice(0, 5).map((s) => s.name),
      lastNames: sorted.slice(-5).map((s) => s.name),
      durationMs: Date.now() - startedAt,
      runId: 'post-fix'
    })
    // #endregion
    return sorted
  }

  getProjectMatrix(
    scan: ScanResult,
    settings: AppSettings,
    resourceType: Exclude<ResourceType, 'mcp'>,
    resourceName: string
  ): ProjectMatrixRow[] {
    const items = filterItems(getItems(scan, resourceType), resourceType)
    const instances = items.filter((i) => matchesResourceName(i, resourceType, resourceName))
    const assignedProjectIds = new Set(
      instances.filter((i) => i.source.type === 'project').map((i) => i.source.id)
    )

    return getAllProjects(settings)
      .map((p) => ({
        projectId: p.id,
        projectName: p.name,
        assigned: assignedProjectIds.has(p.id)
      }))
      .sort((a, b) => a.projectName.localeCompare(b.projectName))
  }

  findCanonicalInstance(
    scan: ScanResult,
    resourceType: Exclude<ResourceType, 'mcp'>,
    resourceName: string
  ): ScannedResource | null {
    const items = filterItems(getItems(scan, resourceType), resourceType)
    const instances = items.filter((i) => matchesResourceName(i, resourceType, resourceName))
    if (instances.length === 0) return null
    return pickCanonical(instances)
  }

  async applyProjectAssignment(
    resourceType: Exclude<ResourceType, 'mcp'>,
    resourceName: string,
    assignedProjectIds: string[]
  ): Promise<void> {
    const settings = settingsStore.get()
    const scan = await scannerService.scanAll(settings)
    const canonical = this.findCanonicalInstance(scan, resourceType, resourceName)
    if (!canonical) throw new Error(`Resource not found: ${resourceName}`)

    const matrix = this.getProjectMatrix(scan, settings, resourceType, resourceName)
    const previousAssigned = new Set(matrix.filter((r) => r.assigned).map((r) => r.projectId))
    const nextAssigned = new Set(assignedProjectIds)

    for (const projectId of nextAssigned) {
      if (!previousAssigned.has(projectId)) {
        await assignmentService.assignToProject(canonical, resourceType, projectId)
      }
    }

    for (const projectId of previousAssigned) {
      if (!nextAssigned.has(projectId)) {
        const diskName =
          resourceType === 'skill' ? skillFolderNameFromKey(resourceName) : resourceName
        await assignmentService.unassignFromProject(diskName, resourceType, projectId)
      }
    }
  }

  async setMandatory(
    resourceType: Exclude<ResourceType, 'mcp'>,
    resourceName: string,
    mandatory: boolean
  ): Promise<void> {
    const mandatoryKey = MANDATORY_KEY[resourceType]
    settingsStore.update((s) => ({
      ...s,
      mandatoryForAllProjects: {
        ...s.mandatoryForAllProjects,
        [mandatoryKey]: {
          ...(s.mandatoryForAllProjects?.[mandatoryKey] ?? {}),
          [resourceName]: mandatory
        }
      }
    }))

    if (mandatory) {
      const settings = settingsStore.get()
      const projectIds = getAllProjects(settings).map((p) => p.id)
      await this.applyProjectAssignment(resourceType, resourceName, projectIds)
    }
  }

  async deleteResource(
    scan: ScanResult,
    resourceType: Exclude<ResourceType, 'mcp'>,
    resourceName: string
  ): Promise<void> {
    await withInAppFsOp(async () => {
      const items = filterItems(getItems(scan, resourceType), resourceType)
      const instances = items.filter((i) => matchesResourceName(i, resourceType, resourceName))
      const seen = new Set<string>()
      const kind = trashKind(resourceType)

      for (const item of instances) {
        if (resourceType === 'hook') {
          const hook = item as HookResource
          const key = `${hook.configPath}::${hook.definition.command ?? ''}`
          if (seen.has(key)) continue
          seen.add(key)
          await this.trashHookInstance(hook, resourceName)
          continue
        }

        let path: string
        switch (resourceType) {
          case 'skill':
            path = (item as SkillResource).rootPath
            break
          case 'rule':
            path = (item as RuleResource).filePath
            break
          case 'subAgent':
            path = (item as SubAgentResource).filePath
            break
          case 'tool':
            path = (item as ToolResource).rootPath
            break
          default:
            continue
        }
        if (seen.has(path)) continue
        seen.add(path)
        await fileService.moveToTrash(path, kind, skillFolderNameFromKey(resourceName), {
          resourceType,
          sourceType: item.source.type,
          sourceId: item.source.id
        })
      }

      const assignKey = ASSIGNMENT_KEY[resourceType]
      settingsStore.update((s) => {
        const nextAssignments = { ...s.assignments[assignKey] }
        for (const item of instances) {
          delete nextAssignments[item.id]
        }
        const nextMandatory = { ...(s.mandatoryForAllProjects?.[MANDATORY_KEY[resourceType]] ?? {}) }
        delete nextMandatory[resourceName]
        if (resourceType === 'skill') {
          delete nextMandatory[skillFolderNameFromKey(resourceName)]
        }

        if (resourceType === 'skill' || resourceType === 'rule') {
          categoriesStore.removeCategory(resourceType, resourceName)
          if (resourceType === 'skill') {
            categoriesStore.removeCategory(resourceType, skillFolderNameFromKey(resourceName))
          }
        }

        return {
          ...s,
          assignments: { ...s.assignments, [assignKey]: nextAssignments },
          mandatoryForAllProjects: {
            ...s.mandatoryForAllProjects,
            [MANDATORY_KEY[resourceType]]: nextMandatory
          }
        }
      })
    })
  }

  async setResourceCategory(
    resourceType: 'skill' | 'rule',
    resourceName: string,
    category: string
  ): Promise<void> {
    categoriesStore.setCategory(resourceType, resourceName, category)
  }

  private async trashHookInstance(hook: HookResource, resourceName: string): Promise<void> {
    const snippet = {
      event: hook.event,
      definition: hook.definition,
      configPath: hook.configPath,
      scriptPath: hook.scriptPath ?? null
    }

    if (hook.scriptPath && existsSync(hook.scriptPath)) {
      await fileService.moveToTrash(hook.scriptPath, 'hooks', resourceName, {
        resourceType: 'hook',
        ...snippet
      })
    } else {
      await fileService.writeTrashMeta('hooks', resourceName, {
        resourceType: 'hook',
        ...snippet
      })
    }

    await this.stripHookFromConfig(hook)
  }

  private async stripHookFromConfig(hook: HookResource): Promise<void> {
    if (!existsSync(hook.configPath)) return
    try {
      const raw = await fileService.readText(hook.configPath)
      const parsed = JSON.parse(raw) as {
        hooks?: Record<string, Array<Record<string, unknown>>>
      }
      const entries = parsed.hooks?.[hook.event] ?? []
      const command = hook.definition.command ?? ''
      const filtered = entries.filter((e) => String(e.command ?? '') !== command)
      if (filtered.length === 0) {
        delete parsed.hooks?.[hook.event]
      } else {
        parsed.hooks ??= {}
        parsed.hooks[hook.event] = filtered
      }
      await fileService.writeText(hook.configPath, JSON.stringify(parsed, null, 2))
    } catch {
      // ignore
    }
  }

  async createResource(
    resourceType: 'skill' | 'rule' | 'hook' | 'subAgent',
    name: string,
    projectIds: string[]
  ): Promise<void> {
    const settings = settingsStore.get()
    const projects = getAllProjects(settings).filter((p) => projectIds.includes(p.id))
    if (projects.length === 0) throw new Error('No projects selected')

    const safeName = name.trim()
    if (!safeName) throw new Error('Name is required')

    await this.writeRepoBankResource(resourceType, safeName)

    for (const project of projects) {
      await this.seedResourceInProject(resourceType, safeName, project)
    }

    if (settings.repoBank.url) {
      try {
        await repoBankService.commitAndPush(`Add ${resourceType} ${safeName}`)
      } catch {
        // repo bank push may fail if not configured yet
      }
    }
  }

  private async seedResourceInProject(
    resourceType: 'skill' | 'rule' | 'hook' | 'subAgent',
    name: string,
    project: ProjectInfo
  ): Promise<void> {
    const settings = settingsStore.get()
    const platforms = CURSOR_ONLY_RESOURCES.includes(resourceType)
      ? settings.platforms.filter((p) => p.enabled && p.id === 'cursor')
      : settings.platforms.filter((p) => p.enabled)

    for (const platform of platforms) {
      const adapter = getAdapter(platform.id)
      if (!adapter) continue
      const paths = adapter.getProjectPaths(project.path)

      switch (resourceType) {
        case 'skill':
          await fileService.writeText(
            join(paths.skillsDirs[0], name, 'SKILL.md'),
            skillTemplate(name)
          )
          break
        case 'rule':
          await fileService.writeText(join(paths.rulesDir, `${name}.mdc`), ruleTemplate(name))
          break
        case 'hook':
          if (paths.hooksConfigPath) {
            await this.appendHook(paths.hooksConfigPath, name)
          }
          break
        case 'subAgent':
          if (paths.agentsDir) {
            await fileService.writeText(
              join(paths.agentsDir, `${name}.md`),
              subAgentTemplate(name)
            )
          }
          break
      }
    }
  }

  private async writeRepoBankResource(
    resourceType: 'skill' | 'rule' | 'hook' | 'subAgent',
    name: string
  ): Promise<void> {
    switch (resourceType) {
      case 'skill':
        await repoBankService.writeResourceFile(resourceType, name, 'SKILL.md', skillTemplate(name))
        break
      case 'rule':
        await repoBankService.writeResourceFile(resourceType, name, `${name}.mdc`, ruleTemplate(name))
        break
      case 'hook': {
        const clonePath = await repoBankService.ensureClone()
        const hooksPath = join(clonePath, 'hooks', 'hooks.json')
        await this.appendHook(hooksPath, name)
        break
      }
      case 'subAgent':
        await repoBankService.writeResourceFile(
          resourceType,
          name,
          `${name}.md`,
          subAgentTemplate(name)
        )
        break
    }
  }

  private async appendHook(hooksPath: string, name: string): Promise<void> {
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
    const scriptPath = join(dirname(hooksPath), 'hooks', `${name}.sh`)
    if (!existsSync(scriptPath)) {
      await fileService.writeText(scriptPath, '#!/bin/sh\necho "hook"\n')
    }
  }

  async renameResource(
    scan: ScanResult,
    resourceType: 'skill' | 'rule' | 'hook' | 'subAgent',
    oldName: string,
    newName: string
  ): Promise<void> {
    const trimmed = newName.trim()
    if (!isValidResourceName(trimmed)) {
      throw new Error('Invalid resource name')
    }

    const skillParsed = resourceType === 'skill' ? parseSkillGroupKey(oldName) : null
    const folderOld = skillParsed?.name ?? oldName
    const targetContentHash = skillParsed?.contentHash
    if (trimmed === folderOld) return

    const items = filterItems(getItems(scan, resourceType), resourceType)
    const existing = groupByName(items, resourceType)
    if (resourceType === 'skill') {
      if (items.some((i) => i.name === trimmed)) {
        throw new Error(`A resource named "${trimmed}" already exists`)
      }
    } else if (existing.has(trimmed)) {
      throw new Error(`A resource named "${trimmed}" already exists`)
    }

    const settings = settingsStore.get()
    if (this.nameExistsOnDisk(settings, resourceType, trimmed)) {
      throw new Error(`A resource named "${trimmed}" already exists`)
    }

    const seen = new Set<string>()

    await withInAppFsOp(async () => {
      // Primary: walk every imported project root so rename never depends on a stale scan.
      for (const { paths, platformId } of iterateProjectPlatformPaths(settings)) {
        if (CURSOR_ONLY_RESOURCES.includes(resourceType) && platformId !== 'cursor') continue

        switch (resourceType) {
          case 'skill':
            for (const skillsDir of paths.skillsDirs) {
              const oldRoot = join(skillsDir, folderOld)
              if (!existsSync(oldRoot)) continue
              if (targetContentHash) {
                const skillMd = join(oldRoot, 'SKILL.md')
                if (!existsSync(skillMd)) continue
                const text = await fileService.readText(skillMd)
                if (skillContentHash(text) !== targetContentHash) continue
              }
              await this.renameSkillAtRoot(oldRoot, trimmed, seen)
            }
            break
          case 'rule': {
            const base = ruleBaseName(folderOld)
            for (const ext of ['.mdc', '.md'] as const) {
              const oldPath = join(paths.rulesDir, `${base}${ext}`)
              if (!existsSync(oldPath)) continue
              await this.renameRuleAtPath(oldPath, trimmed, seen)
            }
            break
          }
          case 'subAgent': {
            if (!paths.agentsDir) break
            const oldPath = join(paths.agentsDir, `${folderOld}.md`)
            if (!existsSync(oldPath)) continue
            await this.renameSubAgentAtPath(oldPath, trimmed, seen)
            break
          }
          case 'hook': {
            if (!paths.hooksConfigPath || !existsSync(paths.hooksConfigPath)) break
            await this.renameHookInConfig(paths, folderOld, trimmed, seen)
            break
          }
        }
      }

      // Fallback: any non-project (local/platform) scan instances not already renamed.
      const instances = items.filter((i) => matchesResourceName(i, resourceType, oldName))
      for (const item of instances) {
        switch (resourceType) {
          case 'skill':
            await this.renameSkillAtRoot((item as SkillResource).rootPath, trimmed, seen)
            break
          case 'rule':
            await this.renameRuleAtPath((item as RuleResource).filePath, trimmed, seen)
            break
          case 'hook':
            await this.renameHookInstance(item as HookResource, folderOld, trimmed, seen)
            break
          case 'subAgent':
            await this.renameSubAgentAtPath((item as SubAgentResource).filePath, trimmed, seen)
            break
        }
      }

      if (seen.size === 0) {
        throw new Error(`Resource not found: ${folderOld}`)
      }

      if (skillParsed) {
        const newGroupKey = skillGroupKey(trimmed, skillParsed.contentHash)
        this.migrateSettingsKeys(resourceType, oldName, newGroupKey)
        this.migrateSettingsKeys(resourceType, folderOld, trimmed)
      } else {
        this.migrateSettingsKeys(resourceType, oldName, trimmed)
      }
    })
  }

  private nameExistsOnDisk(
    settings: AppSettings,
    resourceType: 'skill' | 'rule' | 'hook' | 'subAgent',
    name: string
  ): boolean {
    for (const { paths, platformId } of iterateProjectPlatformPaths(settings)) {
      if (CURSOR_ONLY_RESOURCES.includes(resourceType) && platformId !== 'cursor') continue
      switch (resourceType) {
        case 'skill':
          for (const skillsDir of paths.skillsDirs) {
            if (existsSync(join(skillsDir, name))) return true
          }
          break
        case 'rule': {
          const base = ruleBaseName(name)
          if (
            existsSync(join(paths.rulesDir, `${base}.mdc`)) ||
            existsSync(join(paths.rulesDir, `${base}.md`))
          ) {
            return true
          }
          break
        }
        case 'subAgent':
          if (paths.agentsDir && existsSync(join(paths.agentsDir, `${name}.md`))) return true
          break
        case 'hook':
          // Hook name collisions are validated via scan grouping; skip deep config parse here.
          break
      }
    }
    return false
  }

  private async renameSkillAtRoot(
    oldRoot: string,
    newName: string,
    seen: Set<string>
  ): Promise<void> {
    if (seen.has(oldRoot)) return
    seen.add(oldRoot)
    if (!existsSync(oldRoot)) return

    const parent = dirname(oldRoot)
    const newRoot = join(parent, newName)
    await fileService.renamePath(oldRoot, newRoot)

    const skillMd = join(newRoot, 'SKILL.md')
    if (existsSync(skillMd)) {
      const text = await fileService.readText(skillMd)
      const { frontmatter, body } = parseFrontmatter(text)
      frontmatter.name = newName
      const fmLines = Object.entries(frontmatter).map(([k, v]) => `${k}: ${v}`)
      await fileService.writeText(skillMd, `---\n${fmLines.join('\n')}\n---\n${body}`)
    }
  }

  private async renameRuleAtPath(
    filePath: string,
    newDisplayName: string,
    seen: Set<string>
  ): Promise<void> {
    if (seen.has(filePath)) return
    seen.add(filePath)
    if (!existsSync(filePath)) return

    const newBase = ruleBaseName(newDisplayName)
    const dir = dirname(filePath)
    const ext = filePath.endsWith('.mdc') ? '.mdc' : '.md'
    const newPath = join(dir, `${newBase}${ext}`)
    await fileService.renamePath(filePath, newPath)
  }

  private async renameSubAgentAtPath(
    filePath: string,
    newName: string,
    seen: Set<string>
  ): Promise<void> {
    if (seen.has(filePath)) return
    seen.add(filePath)
    if (!existsSync(filePath)) return

    const dir = dirname(filePath)
    const newPath = join(dir, `${newName}.md`)
    await fileService.renamePath(filePath, newPath)

    if (existsSync(newPath)) {
      const text = await fileService.readText(newPath)
      const { frontmatter, body } = parseFrontmatter(text)
      frontmatter.name = newName
      const fmLines = Object.entries(frontmatter).map(([k, v]) => `${k}: ${v}`)
      await fileService.writeText(newPath, `---\n${fmLines.join('\n')}\n---\n${body}`)
    }
  }

  private async renameHookInConfig(
    paths: PlatformPaths,
    oldName: string,
    newName: string,
    seen: Set<string>
  ): Promise<void> {
    const configPath = paths.hooksConfigPath
    if (!configPath || seen.has(`walk:${configPath}:${oldName}`)) return
    if (!existsSync(configPath)) return

    const raw = await fileService.readText(configPath)
    const parsed = JSON.parse(raw) as {
      hooks?: Record<string, Array<Record<string, unknown>>>
    }
    parsed.hooks ??= {}

    let matched: {
      event: string
      entry: Record<string, unknown>
      command: string
    } | null = null

    for (const [event, entries] of Object.entries(parsed.hooks)) {
      for (const entry of entries) {
        const command = String(entry.command ?? '')
        const scriptBase = basename(command)
        const scriptName = scriptBase.replace(/\.[^.]+$/, '')
        const hookKey = `${event}:${scriptName}`
        if (
          scriptName === oldName ||
          hookKey === oldName ||
          command === oldName ||
          scriptBase === oldName
        ) {
          matched = { event, entry, command }
          break
        }
      }
      if (matched) break
    }

    if (!matched) return
    seen.add(`walk:${configPath}:${oldName}`)

    const hook: HookResource = {
      id: `temp-${configPath}`,
      name: oldName,
      event: matched.event,
      definition: matched.entry as HookResource['definition'],
      configPath,
      scriptPath: matched.command
        ? join(paths.hooksScriptsDir || dirname(configPath), basename(matched.command))
        : undefined,
      scriptFiles: [],
      source: { type: 'project', id: '', label: '' },
      enabled: true
    }

    // Resolve script under hooksScriptsDir when relative.
    if (matched.command && !existsSync(hook.scriptPath ?? '')) {
      const candidate = join(paths.hooksScriptsDir, basename(matched.command))
      if (existsSync(candidate)) hook.scriptPath = candidate
    }

    await this.renameHookInstance(hook, oldName, newName, seen)
  }

  private async renameHookInstance(
    hook: HookResource,
    _oldName: string,
    newName: string,
    seen: Set<string>
  ): Promise<void> {
    const configKey = `${hook.configPath}::${hook.definition.command ?? ''}`
    if (seen.has(configKey)) return
    seen.add(configKey)

    const oldCommand = String(hook.definition.command ?? '')
    const oldScriptBase = basename(oldCommand)

    let newEvent = hook.event
    let newScriptBase: string
    if (newName.includes(':')) {
      const [evt, script] = newName.split(':', 2)
      newEvent = evt
      newScriptBase = script
    } else {
      const ext = oldScriptBase.includes('.')
        ? oldScriptBase.slice(oldScriptBase.indexOf('.'))
        : '.sh'
      newScriptBase = `${newName}${ext}`
    }

    const newCommand = oldCommand.includes('/')
      ? join(dirname(oldCommand), newScriptBase).replace(/\\/g, '/')
      : `hooks/${newScriptBase}`

    if (!existsSync(hook.configPath)) return
    const raw = await fileService.readText(hook.configPath)
    const parsed = JSON.parse(raw) as {
      hooks?: Record<string, Array<Record<string, unknown>>>
    }
    parsed.hooks ??= {}

    const oldEntries = parsed.hooks[hook.event] ?? []
    const remaining: Array<Record<string, unknown>> = []
    let updatedEntry: Record<string, unknown> | null = null

    for (const entry of oldEntries) {
      if (String(entry.command ?? '') === oldCommand) {
        updatedEntry = { ...entry, command: newCommand }
      } else {
        remaining.push(entry)
      }
    }

    if (!updatedEntry) return

    if (remaining.length === 0) {
      delete parsed.hooks[hook.event]
    } else {
      parsed.hooks[hook.event] = remaining
    }

    parsed.hooks[newEvent] = [...(parsed.hooks[newEvent] ?? []), updatedEntry]
    await fileService.writeText(hook.configPath, JSON.stringify(parsed, null, 2))

    if (hook.scriptPath && existsSync(hook.scriptPath)) {
      const scriptDir = dirname(hook.scriptPath)
      const newScriptPath = join(scriptDir, newScriptBase)
      if (hook.scriptPath !== newScriptPath) {
        await fileService.renamePath(hook.scriptPath, newScriptPath)
      }
    }
  }

  private migrateSettingsKeys(
    resourceType: 'skill' | 'rule' | 'hook' | 'subAgent',
    oldName: string,
    newName: string
  ): void {
    const mandatoryKey = MANDATORY_KEY[resourceType]
    settingsStore.update((s) => {
      const mandatory = { ...(s.mandatoryForAllProjects?.[mandatoryKey] ?? {}) }
      if (mandatory[oldName] !== undefined) {
        mandatory[newName] = mandatory[oldName]
        delete mandatory[oldName]
      }

      if (resourceType === 'skill' || resourceType === 'rule') {
        categoriesStore.renameCategory(resourceType, oldName, newName)
      }

      return {
        ...s,
        mandatoryForAllProjects: {
          ...s.mandatoryForAllProjects,
          [mandatoryKey]: mandatory
        }
      }
    })
  }

  async syncMandatoryForNewProjects(newProjectIds: string[]): Promise<void> {
    if (newProjectIds.length === 0) return
    const settings = settingsStore.get()
    const scan = await scannerService.scanAll(settings)
    const mandatory = settings.mandatoryForAllProjects ?? {
      skills: {},
      rules: {},
      hooks: {},
      subAgents: {},
      tools: {}
    }

    const types: Array<Exclude<ResourceType, 'mcp'>> = [
      'skill',
      'rule',
      'hook',
      'subAgent',
      'tool'
    ]

    for (const resourceType of types) {
      const key = MANDATORY_KEY[resourceType]
      const names = Object.entries(mandatory[key] ?? {})
        .filter(([, v]) => v)
        .map(([name]) => name)

      for (const name of names) {
        const canonical = this.findCanonicalInstance(scan, resourceType, name)
        if (!canonical) continue
        for (const projectId of newProjectIds) {
          await assignmentService.assignToProject(canonical, resourceType, projectId)
        }
      }
    }
  }
}

function skillTemplate(name: string): string {
  return `---
name: ${name}
description: 
---

# ${name}

Describe what this skill does.
`
}

function ruleTemplate(name: string): string {
  return `---
description: 
globs: 
alwaysApply: false
---

# ${name}
`
}

function subAgentTemplate(name: string): string {
  return `---
name: ${name}
description: 
---

You are a sub-agent specialized in ${name}.
`
}

export const resourceService = new ResourceService()
