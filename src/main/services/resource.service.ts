import { existsSync } from 'fs'
import { basename, dirname, join } from 'path'
import type {
  AppSettings,
  HookResource,
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
import { ruleDisplayName, ruleMatchesDisplayName } from '@shared/rule-names'
import { parseFrontmatter } from '@shared/utils'
import { fileService } from './file.service'
import { assignmentService } from './assignment.service'
import { scannerService } from './scanner.service'
import { settingsStore } from './settings-store'
import { repoBankService } from './repo-bank.service'

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
  return project ?? instances[0]
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
    for (const [name, instances] of grouped) {
      const canonical = pickCanonical(instances)
      const [tokens, description, ...mtimes] = await Promise.all([
        estimateTokens(canonical, resourceType),
        resourceType === 'skill' || resourceType === 'rule'
          ? extractDescription(canonical, resourceType)
          : Promise.resolve(''),
        ...instances.map((i) => getLastUpdated(i, resourceType))
      ])
      const lastUpdatedAt = mtimes
        .filter((m): m is string => m !== null)
        .sort()
        .pop() ?? null

      summaries.push({
        name,
        usedProjectCount: countProjectsUsing(instances),
        totalProjectCount: totalProjects,
        tokenEstimate: tokens,
        lastUpdatedAt,
        mandatory: mandatoryMap[name] ?? false,
        canonicalId: canonical.id,
        description,
        category: categoryMap[name] ?? ''
      })
    }

    return summaries.sort((a, b) => a.name.localeCompare(b.name))
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
        await assignmentService.unassignFromProject(resourceName, resourceType, projectId)
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
    const items = filterItems(getItems(scan, resourceType), resourceType)
    const instances = items.filter((i) => matchesResourceName(i, resourceType, resourceName))
    const seen = new Set<string>()

    for (const item of instances) {
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
          continue
      }
      if (seen.has(path)) continue
      seen.add(path)

      if (resourceType === 'hook') {
        await this.removeHookFromConfig(item as HookResource)
      } else {
        await fileService.removePath(path)
      }
    }

    const assignKey = ASSIGNMENT_KEY[resourceType]
    settingsStore.update((s) => {
      const nextAssignments = { ...s.assignments[assignKey] }
      for (const item of instances) {
        delete nextAssignments[item.id]
      }
      const nextMandatory = { ...(s.mandatoryForAllProjects?.[MANDATORY_KEY[resourceType]] ?? {}) }
      delete nextMandatory[resourceName]

      const nextCategories = { ...s.resourceCategories }
      if (resourceType === 'skill' || resourceType === 'rule') {
        const catKey = CATEGORY_KEY[resourceType]
        const cats = { ...nextCategories[catKey] }
        delete cats[resourceName]
        nextCategories[catKey] = cats
      }

      return {
        ...s,
        assignments: { ...s.assignments, [assignKey]: nextAssignments },
        mandatoryForAllProjects: {
          ...s.mandatoryForAllProjects,
          [MANDATORY_KEY[resourceType]]: nextMandatory
        },
        resourceCategories: nextCategories
      }
    })
  }

  async setResourceCategory(
    resourceType: 'skill' | 'rule',
    resourceName: string,
    category: string
  ): Promise<void> {
    const catKey = CATEGORY_KEY[resourceType]
    settingsStore.update((s) => ({
      ...s,
      resourceCategories: {
        ...s.resourceCategories,
        [catKey]: {
          ...(s.resourceCategories?.[catKey] ?? {}),
          [resourceName]: category.trim()
        }
      }
    }))
  }

  private async removeHookFromConfig(hook: HookResource): Promise<void> {
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
      if (hook.scriptPath && existsSync(hook.scriptPath)) {
        await fileService.removePath(hook.scriptPath)
      }
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

    for (const project of projects) {
      const cursorDir = join(project.path, '.cursor')
      await this.writeProjectResource(cursorDir, resourceType, safeName)
    }

    await this.writeRepoBankResource(resourceType, safeName)

    if (settings.repoBank.url) {
      try {
        await repoBankService.commitAndPush(`Add ${resourceType} ${safeName}`)
      } catch {
        // repo bank push may fail if not configured yet
      }
    }
  }

  private async writeProjectResource(
    cursorDir: string,
    resourceType: 'skill' | 'rule' | 'hook' | 'subAgent',
    name: string
  ): Promise<void> {
    switch (resourceType) {
      case 'skill': {
        const skillDir = join(cursorDir, 'skills', name)
        await fileService.writeText(join(skillDir, 'SKILL.md'), skillTemplate(name))
        break
      }
      case 'rule': {
        const rulesDir = join(cursorDir, 'rules')
        await fileService.writeText(join(rulesDir, `${name}.mdc`), ruleTemplate(name))
        break
      }
      case 'hook': {
        const hooksPath = join(cursorDir, 'hooks.json')
        await this.appendHook(hooksPath, name)
        break
      }
      case 'subAgent': {
        const agentsDir = join(cursorDir, 'agents')
        await fileService.writeText(join(agentsDir, `${name}.md`), subAgentTemplate(name))
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
