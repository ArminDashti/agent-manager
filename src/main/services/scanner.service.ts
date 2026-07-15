import { existsSync } from 'fs'
import { basename, join } from 'path'
import type {
  AppSettings,
  HookResource,
  McpResource,
  ProjectInfo,
  ResourceSource,
  ResourceType,
  RuleResource,
  ScanResult,
  SkillResource,
  SubAgentResource,
  ToolResource
} from '@shared/types'
import { parseFrontmatter, stableId } from '@shared/utils'
import { fileService } from './file.service'
import { cacheService } from './cache.service'
import { getAdapter } from '../platforms'
import type { PlatformAdapter, PlatformPaths } from '../platforms/types'
import { supportsResource } from '../platforms/types'
import { probeMcpServers } from './mcp-probe.service'

const PLATFORM_SCAN_TYPES: ResourceType[] = ['mcp', 'tool']

export class ScannerService {
  async scanAll(settings: AppSettings): Promise<ScanResult> {
    const result: ScanResult = {
      skills: [],
      rules: [],
      mcps: [],
      hooks: [],
      subAgents: [],
      tools: []
    }

    for (const platform of settings.platforms) {
      if (!platform.enabled) continue
      const adapter = getAdapter(platform.id)
      if (!adapter) continue

      const paths = adapter.getPlatformPaths(platform.rootPath)
      const source: ResourceSource = {
        type: 'platform',
        id: platform.id,
        label: adapter.label
      }

      await this.scanPaths(adapter, paths, source, settings, result, PLATFORM_SCAN_TYPES)
    }

    for (const root of settings.projectRoots) {
      for (const project of root.projects) {
        for (const platform of settings.platforms) {
          if (!platform.enabled) continue
          const adapter = getAdapter(platform.id)
          if (!adapter) continue

          const paths = adapter.getProjectPaths(project.path)
          const source: ResourceSource = {
            type: 'project',
            id: project.id,
            label: `${project.name} (${adapter.label})`
          }

          await this.scanPaths(adapter, paths, source, settings, result)
        }
      }
    }

    const cachePaths = cacheService.getCachePaths()
    const cacheAdapter = getAdapter('cursor')
    if (cacheAdapter) {
      const cacheSource: ResourceSource = {
        type: 'local',
        id: 'cache',
        label: 'Cache'
      }
      await this.scanPaths(cacheAdapter, cachePaths, cacheSource, settings, result, [
        'skill',
        'rule',
        'hook',
        'subAgent'
      ])
    }

    await this.probeMcps(result)

    return result
  }

  private async probeMcps(result: ScanResult): Promise<void> {
    const unique = new Map<string, Record<string, unknown>>()
    for (const mcp of result.mcps) {
      if (!unique.has(mcp.name)) unique.set(mcp.name, mcp.params)
    }

    const probes = await probeMcpServers(
      [...unique.entries()].map(([name, params]) => ({ name, params }))
    )

    for (const mcp of result.mcps) {
      const probe = probes.get(mcp.name)
      if (probe) {
        mcp.status = probe.status
        mcp.tools = probe.tools
      }
    }
  }

  async discoverGitProjects(scanPath: string): Promise<ProjectInfo[]> {
    const projects: ProjectInfo[] = []
    await this.walkForGit(scanPath, projects, scanPath)
    return projects.sort((a, b) => a.name.localeCompare(b.name))
  }

  private async walkForGit(
    dir: string,
    projects: ProjectInfo[],
    rootId: string,
    depth = 0
  ): Promise<void> {
    if (depth > 6) return
    if (!existsSync(dir)) return

    const gitDir = join(dir, '.git')
    if (existsSync(gitDir)) {
      projects.push({
        id: stableId(dir),
        name: basename(dir),
        path: dir,
        rootId
      })
      return
    }

    const subdirs = await fileService.listDirectories(dir)
    for (const sub of subdirs) {
      const name = basename(sub)
      if (name === 'node_modules' || name === '.git') continue
      await this.walkForGit(sub, projects, rootId, depth + 1)
    }
  }

  private async scanPaths(
    adapter: PlatformAdapter,
    paths: PlatformPaths,
    source: ResourceSource,
    settings: AppSettings,
    result: ScanResult,
    allowedTypes?: ResourceType[]
  ): Promise<void> {
    const canScan = (type: ResourceType) => !allowedTypes || allowedTypes.includes(type)

    if (canScan('skill') && supportsResource(adapter, 'skill')) {
      for (const skillsDir of paths.skillsDirs) {
        const dirs = await fileService.listDirectories(skillsDir)
        for (const dir of dirs) {
          const skillMd = join(dir, 'SKILL.md')
          if (!existsSync(skillMd)) continue
          const files = await fileService.listFilesRecursive(dir)
          const id = stableId(source.id, dir)
          result.skills.push({
            id,
            name: basename(dir),
            rootPath: dir,
            skillMdPath: skillMd,
            files,
            source,
            enabled: settings.assignments.skills[id]?.includes(source.id) ?? true
          })
        }
      }
    }

    if (canScan('rule') && supportsResource(adapter, 'rule') && existsSync(paths.rulesDir)) {
      const files = await fileService.listFilesRecursive(paths.rulesDir)
      for (const file of files) {
        if (!/\.(mdc|md)$/i.test(file)) continue
        const id = stableId(source.id, file)
        result.rules.push({
          id,
          name: basename(file),
          filePath: file,
          source,
          enabled: settings.assignments.rules[id]?.includes(source.id) ?? true
        })
      }
    }

    if (canScan('mcp') && supportsResource(adapter, 'mcp') && existsSync(paths.mcpConfigPath)) {
      try {
        const raw = await fileService.readText(paths.mcpConfigPath)
        const parsed = JSON.parse(raw) as { mcpServers?: Record<string, Record<string, unknown>> }
        for (const [name, params] of Object.entries(parsed.mcpServers ?? {})) {
          const id = stableId(source.id, name)
          result.mcps.push({
            id,
            name,
            params,
            tools: [],
            status: 'unknown',
            platforms: [source.id],
            configPath: paths.mcpConfigPath
          })
        }
      } catch {
        // ignore invalid mcp.json
      }
    }

    if (
      canScan('hook') &&
      supportsResource(adapter, 'hook') &&
      paths.hooksConfigPath &&
      existsSync(paths.hooksConfigPath)
    ) {
      try {
        const raw = await fileService.readText(paths.hooksConfigPath)
        const parsed = JSON.parse(raw) as {
          hooks?: Record<string, Array<Record<string, unknown>>>
        }
        const scriptFiles = paths.hooksScriptsDir
          ? await fileService.listFilesRecursive(paths.hooksScriptsDir)
          : []

        for (const [event, entries] of Object.entries(parsed.hooks ?? {})) {
          for (const entry of entries) {
            const command = String(entry.command ?? '')
            const hookName = `${event}:${basename(command) || 'hook'}`
            const id = stableId(source.id, hookName)
            result.hooks.push({
              id,
              event,
              name: hookName,
              configPath: paths.hooksConfigPath,
              definition: entry as HookResource['definition'],
              scriptPath: command ? join(paths.hooksScriptsDir!, basename(command)) : undefined,
              scriptFiles,
              source,
              enabled: settings.assignments.hooks[id]?.includes(source.id) ?? true
            })
          }
        }
      } catch {
        // ignore
      }
    }

    if (
      canScan('subAgent') &&
      supportsResource(adapter, 'subAgent') &&
      paths.agentsDir &&
      existsSync(paths.agentsDir)
    ) {
      const files = await fileService.listFilesRecursive(paths.agentsDir)
      for (const file of files) {
        if (!/\.md$/i.test(file)) continue
        const content = await fileService.readText(file)
        const { frontmatter } = parseFrontmatter(content)
        const id = stableId(source.id, file)
        result.subAgents.push({
          id,
          name: String(frontmatter.name ?? basename(file, '.md')),
          description: String(frontmatter.description ?? ''),
          filePath: file,
          frontmatter,
          source,
          enabled: settings.assignments.subAgents[id]?.includes(source.id) ?? true
        })
      }
    }

    if (canScan('tool') && supportsResource(adapter, 'tool') && existsSync(paths.toolsDir)) {
      const dirs = await fileService.listDirectories(paths.toolsDir)
      for (const dir of dirs) {
        const files = await fileService.listFilesRecursive(dir)
        let description: string | undefined
        let entrypoint: string | undefined
        const toolJson = join(dir, 'tool.json')
        if (existsSync(toolJson)) {
          try {
            const meta = JSON.parse(await fileService.readText(toolJson)) as {
              name?: string
              description?: string
              entrypoint?: string
            }
            description = meta.description
            entrypoint = meta.entrypoint
          } catch {
            // ignore
          }
        }
        const id = stableId(source.id, dir)
        result.tools.push({
          id,
          name: basename(dir),
          description,
          rootPath: dir,
          entrypoint,
          files,
          source,
          enabled: settings.assignments.tools[id]?.includes(source.id) ?? true
        })
      }
    }
  }
}

export const scannerService = new ScannerService()
