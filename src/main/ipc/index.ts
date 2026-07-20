import { ipcMain, dialog, BrowserWindow, app } from 'electron'
import { existsSync } from 'fs'
import { join, basename } from 'path'
import type { AppSettings, HubResourceType, PlatformId, ResourceType } from '@shared/types'
import { createDefaultSettings } from '@shared/defaults'
import { expandHome, stableId } from '@shared/utils'
import { ensurePortableLayout, getLogosPath, getBrandingPath, getAppRoot } from '../app-paths'
import { settingsStore } from '../services/settings-store'
import { importedProjectsStore } from '../services/imported-projects-store'
import { fileService } from '../services/file.service'
import { scannerService } from '../services/scanner.service'
import { assignmentService } from '../services/assignment.service'
import { resourceService } from '../services/resource.service'
import { hubService } from '../services/hub.service'
import { repoBankService } from '../services/repo-bank.service'
import { platformCleanupService } from '../services/platform-cleanup.service'
import { projectBootstrapService } from '../services/project-bootstrap.service'
import { startFileWatcher, stopFileWatcher } from '../services/watcher.service'
import { restartSyncTimer } from '../services/sync.service'
import { applyStartupSetting } from '../services/startup.service'
import { validatePat } from '../services/github.service'
import {
  refactorWithOpenRouter,
  type OpenRouterRefactorRequest
} from '../services/openrouter.service'
import { getAdapter } from '../platforms'
import { agentDebugLog } from '../services/debug-log'
import { v4 as uuidv4 } from 'uuid'

export function registerIpc(): void {
  ipcMain.handle('app:getRoot', () => getAppRoot())

  ipcMain.handle('settings:get', () => settingsStore.get())

  ipcMain.handle('settings:save', (_e, settings: AppSettings) => {
    settingsStore.save(settings)
    applyStartupSetting(settings.startup?.runOnLogin ?? false)
    stopFileWatcher()
    startFileWatcher()
    restartSyncTimer()
    return settingsStore.get()
  })

  ipcMain.handle('settings:reset', () => {
    const defaults = createDefaultSettings()
    settingsStore.save(defaults)
    // Imported projects live in imported-projects.json — reset must not clear them.
    return settingsStore.get()
  })

  ipcMain.handle('github:validatePat', async (_e, pat: string) => validatePat(pat))

  ipcMain.handle('openRouter:refactor', async (_e, request: OpenRouterRefactorRequest) =>
    refactorWithOpenRouter(request)
  )

  ipcMain.handle('scan:all', async (_e, options?: { probeMcps?: boolean }) => {
    // #region agent log
    const startedAt = Date.now()
    agentDebugLog('B', 'ipc/index.ts:scan:all', 'IPC scan:all invoked', {
      probeMcps: options?.probeMcps === true,
      runId: 'post-fix'
    })
    // #endregion
    const result = await scannerService.scanAll(settingsStore.get(), options)
    // #region agent log
    agentDebugLog('B', 'ipc/index.ts:scan:all:done', 'IPC scan:all done', {
      durationMs: Date.now() - startedAt,
      probeMcps: options?.probeMcps === true,
      runId: 'post-fix'
    })
    // #endregion
    return result
  })

  ipcMain.handle('scan:projects', async (_e, scanPath: string) =>
    scannerService.discoverGitProjects(scanPath)
  )

  ipcMain.handle('file:read', async (_e, filePath: string) => fileService.readText(filePath))

  ipcMain.handle('file:write', async (_e, filePath: string, content: string) => {
    await fileService.writeText(filePath, content)
    return true
  })

  ipcMain.handle('file:listDir', async (_e, dir: string) => fileService.listFilesRecursive(dir))

  ipcMain.handle('file:listEntries', async (_e, dir: string) => fileService.listEntries(dir))

  ipcMain.handle('dialog:openDirectory', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('dialog:openDirectories', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory', 'multiSelections']
    })
    return result.canceled ? [] : result.filePaths
  })

  ipcMain.handle('assign:targets', async (_e, resourceType: ResourceType) =>
    assignmentService.getTargets(settingsStore.get(), resourceType)
  )

  ipcMain.handle(
    'resource:stats',
    async (_e, resourceType: Exclude<ResourceType, 'mcp'>) => {
      // #region agent log
      const startedAt = Date.now()
      agentDebugLog('B', 'ipc/index.ts:resource:stats', 'IPC resource:stats invoked', {
        resourceType
      })
      // #endregion
      const settings = settingsStore.get()
      const scan = await scannerService.scanAll(settings)
      // #region agent log
      const afterScanAt = Date.now()
      // #endregion
      const summaries = await resourceService.getGroupSummaries(scan, settings, resourceType)
      // #region agent log
      agentDebugLog('B', 'ipc/index.ts:resource:stats:done', 'IPC resource:stats done', {
        resourceType,
        scanMs: afterScanAt - startedAt,
        summariesMs: Date.now() - afterScanAt,
        totalMs: Date.now() - startedAt,
        summaryCount: summaries.length,
        scanSkillCount: scan.skills.length,
        uniqueScanSkillNames: [...new Set(scan.skills.map((s) => s.name))].length
      })
      // #endregion
      return summaries
    }
  )

  ipcMain.handle(
    'assign:getProjectMatrix',
    async (_e, resourceType: Exclude<ResourceType, 'mcp'>, resourceName: string) => {
      const settings = settingsStore.get()
      const scan = await scannerService.scanAll(settings)
      return resourceService.getProjectMatrix(scan, settings, resourceType, resourceName)
    }
  )

  ipcMain.handle(
    'assign:apply',
    async (
      _e,
      resourceType: Exclude<ResourceType, 'mcp'>,
      resourceName: string,
      assignedProjectIds: string[]
    ) => {
      await resourceService.applyProjectAssignment(resourceType, resourceName, assignedProjectIds)
      return true
    }
  )

  ipcMain.handle(
    'assign:setMandatory',
    async (_e, resourceType: Exclude<ResourceType, 'mcp'>, resourceName: string, mandatory: boolean) => {
      await resourceService.setMandatory(resourceType, resourceName, mandatory)
      return true
    }
  )

  ipcMain.handle(
    'resource:setCategory',
    async (_e, resourceType: 'skill' | 'rule', resourceName: string, category: string) => {
      await resourceService.setResourceCategory(resourceType, resourceName, category)
      return true
    }
  )

  ipcMain.handle(
    'resource:rename',
    async (
      _e,
      resourceType: 'skill' | 'rule' | 'hook' | 'subAgent',
      oldName: string,
      newName: string
    ) => {
      const settings = settingsStore.get()
      const scan = await scannerService.scanAll(settings)
      await resourceService.renameResource(scan, resourceType, oldName, newName)
      return true
    }
  )

  ipcMain.handle(
    'resource:delete',
    async (_e, resourceType: Exclude<ResourceType, 'mcp'>, resourceName: string) => {
      const settings = settingsStore.get()
      const scan = await scannerService.scanAll(settings)
      await resourceService.deleteResource(scan, resourceType, resourceName)
      return true
    }
  )

  ipcMain.handle('mcp:delete', async (_e, name: string, configPath: string) => {
    if (!existsSync(configPath)) return false
    const raw = await fileService.readText(configPath)
    const config = JSON.parse(raw) as { mcpServers?: Record<string, unknown> }
    if (config.mcpServers) delete config.mcpServers[name]
    await fileService.writeText(configPath, JSON.stringify(config, null, 2))
    return true
  })

  ipcMain.handle('mcp:add', async (_e, name: string, params: Record<string, unknown>) => {
    const settings = settingsStore.get()
    const platform =
      settings.platforms.find((p) => p.enabled && p.id === 'cursor') ??
      settings.platforms.find((p) => p.enabled)
    if (!platform) throw new Error('No enabled platform')
    const adapter = getAdapter(platform.id)
    if (!adapter) throw new Error('No adapter')
    const paths = adapter.getPlatformPaths(platform.rootPath)
    let config: { mcpServers?: Record<string, unknown> } = { mcpServers: {} }
    if (existsSync(paths.mcpConfigPath)) {
      config = JSON.parse(await fileService.readText(paths.mcpConfigPath))
    }
    config.mcpServers ??= {}
    config.mcpServers[name] = params
    await fileService.writeText(paths.mcpConfigPath, JSON.stringify(config, null, 2))
    return paths.mcpConfigPath
  })

  ipcMain.handle(
    'resource:getCanonical',
    async (_e, resourceType: Exclude<ResourceType, 'mcp'>, resourceName: string) => {
      const settings = settingsStore.get()
      const scan = await scannerService.scanAll(settings)
      return resourceService.findCanonicalInstance(scan, resourceType, resourceName)
    }
  )

  ipcMain.handle('platform:purgeFromProjects', async (_e, platformIds: PlatformId[]) => {
    return platformCleanupService.purgeFromProjects(platformIds)
  })

  ipcMain.handle('platform:add', async (_e, id: PlatformId, rootPath: string) => {
    settingsStore.update((s) => {
      const existing = s.platforms.find((p) => p.id === id)
      if (existing) {
        existing.rootPath = expandHome(rootPath)
        existing.enabled = true
        return { ...s }
      }
      return {
        ...s,
        platforms: [...s.platforms, { id, enabled: true, rootPath: expandHome(rootPath) }]
      }
    })
    return settingsStore.get()
  })

  ipcMain.handle(
    'resource:create',
    async (
      _e,
      resourceType: 'skill' | 'rule' | 'hook' | 'subAgent',
      name: string,
      projectIds: string[]
    ) => {
      await resourceService.createResource(resourceType, name, projectIds)
      return true
    }
  )

  ipcMain.handle('projects:import', async (_e, paths: string[]) => {
    const previousIds = new Set(
      importedProjectsStore.get().flatMap((r) => r.projects.map((p) => p.id))
    )
    const collected: Array<{ id: string; name: string; path: string; rootId: string }> = []

    for (const scanPath of paths) {
      if (existsSync(join(scanPath, '.git'))) {
        collected.push({
          id: stableId(scanPath),
          name: basename(scanPath),
          path: scanPath,
          rootId: scanPath
        })
      } else {
        const discovered = await scannerService.discoverGitProjects(scanPath)
        collected.push(...discovered)
      }
    }

    const seen = new Set(importedProjectsStore.get().flatMap((r) => r.projects.map((p) => p.id)))
    const newProjects = collected.filter((p) => !seen.has(p.id))
    if (newProjects.length === 0) return { imported: 0, projects: [] }

    await projectBootstrapService.bootstrapProjects(newProjects.map((p) => p.path))

    const rootId = uuidv4()
    importedProjectsStore.update((roots) => [
      ...roots,
      {
        id: rootId,
        scanPath: paths[0] ?? 'imported',
        projects: newProjects.map((p) => ({ ...p, rootId }))
      }
    ])

    const newProjectIds = newProjects.filter((p) => !previousIds.has(p.id)).map((p) => p.id)
    await resourceService.syncMandatoryForNewProjects(newProjectIds)
    stopFileWatcher()
    startFileWatcher()
    return { imported: newProjects.length, projects: newProjects }
  })

  ipcMain.handle('projects:remove', async (_e, projectId: string) => {
    importedProjectsStore.update((roots) =>
      roots
        .map((root) => ({
          ...root,
          projects: root.projects.filter((p) => p.id !== projectId)
        }))
        .filter((root) => root.projects.length > 0)
    )
    stopFileWatcher()
    startFileWatcher()
    return true
  })

  ipcMain.handle('projectRoot:add', async (_e, scanPath: string) => {
    const previousIds = new Set(
      importedProjectsStore.get().flatMap((r) => r.projects.map((p) => p.id))
    )
    const projects = await scannerService.discoverGitProjects(scanPath)
    await projectBootstrapService.bootstrapProjects(projects.map((p) => p.path))
    const id = uuidv4()
    importedProjectsStore.update((roots) => [...roots, { id, scanPath, projects }])
    const newProjectIds = projects.filter((p) => !previousIds.has(p.id)).map((p) => p.id)
    await resourceService.syncMandatoryForNewProjects(newProjectIds)
    stopFileWatcher()
    startFileWatcher()
    return { id, projects }
  })

  ipcMain.handle('hub:fetchCatalog', async () => hubService.fetchCatalog())

  ipcMain.handle('hub:list', async () => hubService.listCatalog())

  ipcMain.handle('hub:fetchResource', async (_e, type: HubResourceType, name: string) =>
    hubService.fetchResource(type, name)
  )

  ipcMain.handle('hub:install', async (_e, type: HubResourceType, name: string, destDir: string) =>
    hubService.installResource(type, name, destDir)
  )

  ipcMain.handle('repoBank:fetch', async () => repoBankService.fetch())

  ipcMain.handle('repoBank:commitPush', async (_e, message: string) =>
    repoBankService.commitAndPush(message)
  )

  ipcMain.handle('window:minimize', () => {
    BrowserWindow.getFocusedWindow()?.minimize()
    return true
  })

  ipcMain.handle('window:maximize', () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return false
    if (win.isMaximized()) {
      win.unmaximize()
      return false
    }
    win.maximize()
    return true
  })

  ipcMain.handle('window:close', () => {
    const win = BrowserWindow.getFocusedWindow()
    if (win) {
      const maximized = win.isMaximized()
      settingsStore.update((s) => ({
        ...s,
        window: { maximized }
      }))
      win.close()
    }
    return true
  })

  ipcMain.handle('window:isMaximized', () => BrowserWindow.getFocusedWindow()?.isMaximized() ?? false)

  // #region agent log
  ipcMain.handle(
    'debug:log',
    (
      _e,
      hypothesisId: string,
      location: string,
      message: string,
      data: Record<string, unknown> = {}
    ) => {
      agentDebugLog(hypothesisId, location, message, { ...data, runId: 'post-fix' })
      return true
    }
  )
  // #endregion

  ipcMain.handle('logos:getPath', (_e, platformId: string) => {
    const logosDir = getLogosPath()
    const png = join(logosDir, `${platformId}.png`)
    const svg = join(logosDir, `${platformId}.svg`)
    if (existsSync(png)) return png
    if (existsSync(svg)) return svg
    return null
  })

  ipcMain.handle('branding:getPath', (_e, name: 'janus-icon' | 'janus-logo') => {
    const brandingDir = getBrandingPath()
    const png = join(brandingDir, `${name}.png`)
    if (existsSync(png)) return png
    return null
  })

  ipcMain.on('watcher:restart', () => {
    stopFileWatcher()
    startFileWatcher()
    restartSyncTimer()
  })

  ensurePortableLayout()
}
