import { watch } from 'chokidar'
import { BrowserWindow } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { settingsStore } from './settings-store'
import { getAdapter } from '../platforms'
import { scheduleSkillSyncFromPath } from './skill-sync.service'

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
      for (const platform of settings.platforms) {
        if (!platform.enabled) continue
        const adapter = getAdapter(platform.id)
        if (!adapter) continue
        const projectPaths = adapter.getProjectPaths(project.path)

        if (platform.id === 'cursor') {
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
        } else {
          for (const skillsDir of projectPaths.skillsDirs) {
            if (existsSync(skillsDir)) paths.add(skillsDir)
          }
          if (existsSync(projectPaths.toolsDir)) paths.add(projectPaths.toolsDir)
          if (existsSync(projectPaths.mcpConfigPath)) paths.add(projectPaths.mcpConfigPath)
        }
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

  const onSkillOrNotify = (changedPath: string): void => {
    scheduleSkillSyncFromPath(changedPath)
    notify()
  }

  watcher.on('add', onSkillOrNotify).on('change', onSkillOrNotify).on('unlink', onSkillOrNotify)
}

export function stopFileWatcher(): void {
  if (notifyTimer) {
    clearTimeout(notifyTimer)
    notifyTimer = null
  }
  void watcher?.close()
  watcher = null
}
