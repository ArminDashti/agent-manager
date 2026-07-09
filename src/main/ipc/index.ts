import { ipcMain, dialog, BrowserWindow, app } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import type { AppSettings, HubResourceType, PlatformId, ResourceType } from '@shared/types'
import { createDefaultSettings } from '@shared/defaults'
import { expandHome } from '@shared/utils'
import { ensurePortableLayout, getLogosPath, getAppRoot } from '../app-paths'
import { settingsStore } from '../services/settings-store'
import { fileService } from '../services/file.service'
import { scannerService } from '../services/scanner.service'
import { assignmentService } from '../services/assignment.service'
import { hubService } from '../services/hub.service'
import { repoBankService } from '../services/repo-bank.service'
import { startFileWatcher, stopFileWatcher } from '../services/watcher.service'
import { v4 as uuidv4 } from 'uuid'

let keytar: typeof import('keytar') | null = null
try {
  keytar = require('keytar')
} catch {
  keytar = null
}

const SERVICE_NAME = 'agent-manager'
const ACCOUNT_NAME = 'github-pat'

export function registerIpc(): void {
  ipcMain.handle('app:getRoot', () => getAppRoot())

  ipcMain.handle('settings:get', () => settingsStore.get())

  ipcMain.handle('settings:save', (_e, settings: AppSettings) => {
    settingsStore.save(settings)
    return settingsStore.get()
  })

  ipcMain.handle('settings:reset', () => {
    const defaults = createDefaultSettings()
    settingsStore.save(defaults)
    return defaults
  })

  ipcMain.handle('pat:get', async () => {
    if (keytar) {
      return (await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME)) ?? ''
    }
    return ''
  })

  ipcMain.handle('pat:set', async (_e, token: string) => {
    if (keytar) {
      if (token) await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, token)
      else await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME)
    }
    return true
  })

  ipcMain.handle('scan:all', async () => scannerService.scanAll(settingsStore.get()))

  ipcMain.handle('scan:projects', async (_e, scanPath: string) =>
    scannerService.discoverGitProjects(scanPath)
  )

  ipcMain.handle('file:read', async (_e, filePath: string) => fileService.readText(filePath))

  ipcMain.handle('file:write', async (_e, filePath: string, content: string) => {
    await fileService.writeText(filePath, content)
    return true
  })

  ipcMain.handle('file:listDir', async (_e, dir: string) => fileService.listFilesRecursive(dir))

  ipcMain.handle('dialog:openDirectory', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('assign:targets', async (_e, resourceType: ResourceType) =>
    assignmentService.getTargets(settingsStore.get(), resourceType)
  )

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

  ipcMain.handle('projectRoot:add', async (_e, scanPath: string) => {
    const projects = await scannerService.discoverGitProjects(scanPath)
    const id = uuidv4()
    settingsStore.update((s) => ({
      ...s,
      projectRoots: [...s.projectRoots, { id, scanPath, projects }]
    }))
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

  ipcMain.handle('logos:getPath', (_e, platformId: string) => {
    const logosDir = getLogosPath()
    const png = join(logosDir, `${platformId}.png`)
    const svg = join(logosDir, `${platformId}.svg`)
    if (existsSync(png)) return png
    if (existsSync(svg)) return svg
    return null
  })

  ipcMain.on('watcher:restart', () => {
    stopFileWatcher()
    startFileWatcher()
  })

  ensurePortableLayout()
}
