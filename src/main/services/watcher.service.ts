import { watch } from 'chokidar'
import { BrowserWindow } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { settingsStore } from './settings-store'
import { getAdapter } from '../platforms'

let watcher: ReturnType<typeof watch> | null = null
let notifyTimer: ReturnType<typeof setTimeout> | null = null

function collectWatchPaths(): string[] {
  const settings = settingsStore.get()
  const paths = new Set<string>()

  for (const platform of settings.platforms) {
    if (!platform.enabled) continue
    const adapter = getAdapter(platform.id)
    if (!adapter) continue

    const platformPaths = adapter.getPlatformPaths(platform.rootPath)
    const candidates = [platformPaths.toolsDir, join(platform.rootPath, 'mcp.json')]

    for (const p of candidates) {
      if (p && existsSync(p)) paths.add(p)
    }
  }

  for (const root of settings.projectRoots) {
    for (const project of root.projects) {
      const cursorAdapter = getAdapter('cursor')
      if (!cursorAdapter) continue
      const projectPaths = cursorAdapter.getProjectPaths(project.path)
      const candidates = [
        ...projectPaths.skillsDirs,
        projectPaths.rulesDir,
        projectPaths.hooksScriptsDir,
        projectPaths.agentsDir,
        projectPaths.hooksConfigPath
      ]
      for (const p of candidates) {
        if (p && existsSync(p)) paths.add(p)
      }
      for (const platform of settings.platforms) {
        if (!platform.enabled || platform.id === 'cursor') continue
        const adapter = getAdapter(platform.id)
        if (!adapter) continue
        const pp = adapter.getProjectPaths(project.path)
        if (existsSync(pp.toolsDir)) paths.add(pp.toolsDir)
        if (existsSync(pp.mcpConfigPath)) paths.add(pp.mcpConfigPath)
      }
    }
  }

  return [...paths]
}

export function startFileWatcher(): void {
  if (watcher) return

  const paths = collectWatchPaths()
  if (paths.length === 0) return

  watcher = watch(paths, {
    ignoreInitial: true,
    depth: 4,
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 }
  })

  const notify = (): void => {
    if (notifyTimer) clearTimeout(notifyTimer)
    notifyTimer = setTimeout(() => {
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('scan:changed')
      }
    }, 1500)
  }

  watcher.on('add', notify).on('change', notify).on('unlink', notify)
}

export function stopFileWatcher(): void {
  if (notifyTimer) {
    clearTimeout(notifyTimer)
    notifyTimer = null
  }
  void watcher?.close()
  watcher = null
}
