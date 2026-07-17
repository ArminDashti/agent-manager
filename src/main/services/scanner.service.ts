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
import { getAdapter } from '../platforms'
import type { PlatformAdapter, PlatformPaths } from '../platforms/types'
import { supportsResource } from '../platforms/types'
import { probeMcpServers } from './mcp-probe.service'
import { agentDebugLog } from './debug-log'

const PLATFORM_SCAN_TYPES: ResourceType[] = ['mcp', 'tool']

export interface ScanAllOptions {
  /** Spawn MCP processes to check connectivity. Expensive; default false. */
  probeMcps?: boolean
}

export class ScannerService {
  private inflight: Promise<ScanResult> | null = null
  private inflightProbe = false

  async scanAll(settings: AppSettings, options: ScanAllOptions = {}): Promise<ScanResult> {
    const probeMcps = options.probeMcps === true

    // Share one in-flight scan when concurrent callers agree on probe level
    if (this.inflight && (!probeMcps || this.inflightProbe)) {
      // #region agent log
      agentDebugLog('C', 'scanner.service.ts:scanAll:reuse', 'reusing in-flight scanAll', {
        probeMcps,
        inflightProbe: this.inflightProbe
      })
      // #endregion
      return this.inflight
    }

    const run = this.executeScanAll(settings, probeMcps)
    this.inflight = run
    this.inflightProbe = probeMcps
    try {
      return await run
    } finally {
      if (this.inflight === run) {
        this.inflight = null
        this.inflightProbe = false
      }
    }
  }

  private async executeScanAll(settings: AppSettings, probeMcps: boolean): Promise<ScanResult> {
    // #region agent log
    const scanStartedAt = Date.now()
    const projectCount = settings.projectRoots.reduce((n, r) => n + r.projects.length, 0)
    const enabledPlatforms = settings.platforms.filter((p) => p.enabled).length
    agentDebugLog('E', 'scanner.service.ts:scanAll:start', 'scanAll started', {
      projectCount,
      enabledPlatforms,
      probeMcps,
      runId: 'post-fix'
    })
    // #endregion

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

    // #region agent log
    const fsScanMs = Date.now() - scanStartedAt
    agentDebugLog('A', 'scanner.service.ts:scanAll:afterFs', 'filesystem scan done', {
      fsScanMs,
      skills: result.skills.length,
      uniqueSkillNames: [...new Set(result.skills.map((s) => s.name))].length,
      rules: result.rules.length,
      mcps: result.mcps.length,
      hooks: result.hooks.length,
      subAgents: result.subAgents.length,
      tools: result.tools.length,
      probeMcps
    })
    // #endregion

    if (probeMcps) {
      await this.probeMcps(result)
    }

    // #region agent log
    agentDebugLog('A', 'scanner.service.ts:scanAll:end', 'scanAll finished', {
      totalMs: Date.now() - scanStartedAt,
      fsScanMs,
      mcpCount: result.mcps.length,
      probeMcps,
      runId: 'post-fix'
    })
    // #endregion

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
