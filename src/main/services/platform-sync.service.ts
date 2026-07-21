import type {
  HookResource,
  ResourceType,
  RuleResource,
  ScanResult,
  SkillResource,
  SubAgentResource,
  ToolResource
} from '@shared/types'
import { ruleDisplayName } from '@shared/rule-names'
import { assignmentService } from './assignment.service'
import { projectBootstrapService } from './project-bootstrap.service'
import { scannerService } from './scanner.service'
import { settingsStore } from './settings-store'

type ScannedResource =
  | SkillResource
  | RuleResource
  | HookResource
  | SubAgentResource
  | ToolResource

const FILL_TYPES: Array<Exclude<ResourceType, 'mcp'>> = [
  'skill',
  'rule',
  'hook',
  'subAgent',
  'tool'
]

function getItems(scan: ScanResult, resourceType: Exclude<ResourceType, 'mcp'>): ScannedResource[] {
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
  }
}

function resourceKey(item: ScannedResource, resourceType: Exclude<ResourceType, 'mcp'>): string {
  if (resourceType === 'rule') return ruleDisplayName(item.name)
  return item.name
}

/**
 * Ensure enabled platform folders exist in all projects, then re-copy each
 * project-assigned resource into every currently enabled platform.
 */
export async function syncEnabledPlatformsToProjects(): Promise<void> {
  const settings = settingsStore.get()
  const projectPaths = settings.projectRoots.flatMap((r) => r.projects.map((p) => p.path))
  if (projectPaths.length === 0) {
    // Still ensure nothing to do when no projects — bootstrap is a no-op.
    await projectBootstrapService.bootstrapEnabledPlatformsForAllProjects()
    return
  }

  await projectBootstrapService.bootstrapEnabledPlatformsForAllProjects()

  const scan = await scannerService.scanAll(settingsStore.get())

  for (const resourceType of FILL_TYPES) {
    // Dedupe: one assign per (resource name, projectId)
    const seen = new Set<string>()

    for (const item of getItems(scan, resourceType)) {
      if (item.source.type !== 'project') continue

      const name = resourceKey(item, resourceType)
      const projectId = item.source.id
      const dedupeKey = `${resourceType}:${name}:${projectId}`
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)

      // Prefer a project instance as canonical source for copying
      const sameName = getItems(scan, resourceType).filter((candidate) => {
        if (resourceKey(candidate, resourceType) !== name) return false
        return true
      })
      const canonical =
        sameName.find((c) => c.source.type === 'project' && c.source.id === projectId) ??
        sameName.find((c) => c.source.type === 'project') ??
        sameName.find((c) => c.source.type === 'platform') ??
        sameName[0]

      if (!canonical) continue
      await assignmentService.assignToProject(canonical, resourceType, projectId)
    }
  }
}

export const platformSyncService = {
  syncEnabledPlatformsToProjects
}
