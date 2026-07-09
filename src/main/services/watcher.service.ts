import { watch } from 'chokidar'
import { BrowserWindow } from 'electron'
import { settingsStore } from './settings-store'

let watcher: ReturnType<typeof watch> | null = null

export function startFileWatcher(): void {
  if (watcher) return

  const settings = settingsStore.get()
  const paths = settings.platforms.filter((p) => p.enabled).map((p) => p.rootPath)
  if (paths.length === 0) return

  watcher = watch(paths, {
    ignored: /(^|[/\\])\../,
    ignoreInitial: true,
    depth: 6
  })

  const notify = (): void => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('scan:changed')
    }
  }

  watcher.on('add', notify).on('change', notify).on('unlink', notify)
}

export function stopFileWatcher(): void {
  void watcher?.close()
  watcher = null
}
