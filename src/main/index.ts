import { app, BrowserWindow, Menu, shell, nativeImage } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { registerIpc } from './ipc'
import { settingsStore } from './services/settings-store'
import { ensurePortableLayout, getBundledBrandingPath } from './app-paths'
import { startFileWatcher } from './services/watcher.service'
import { startSyncTimer } from './services/sync.service'
import { applyStartupSetting } from './services/startup.service'

let mainWindow: BrowserWindow | null = null

async function migratePatFromKeytar(): Promise<void> {
  const settings = settingsStore.get()
  if (settings.github?.pat) return

  try {
    const keytar = require('keytar') as typeof import('keytar')
    const pat = await keytar.getPassword('agent-manager', 'github-pat')
    if (pat) {
      settingsStore.update((s) => ({
        ...s,
        github: { ...s.github, pat, patValid: false, patValidatedAt: null }
      }))
      await keytar.deletePassword('agent-manager', 'github-pat')
    }
  } catch {
    // keytar unavailable
  }
}

function createWindow(): void {
  const settings = settingsStore.load()
  ensurePortableLayout()

  const preloadPath = existsSync(join(__dirname, '../preload/index.mjs'))
    ? join(__dirname, '../preload/index.mjs')
    : join(__dirname, '../preload/index.js')

  const iconPath = join(getBundledBrandingPath(), 'janus-icon.png')
  const icon = existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : undefined

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    title: 'Janus',
    icon,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    if (settings.window.maximized) {
      mainWindow?.maximize()
    }
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null)
  registerIpc()
  settingsStore.load()
  await migratePatFromKeytar()
  const settings = settingsStore.get()
  applyStartupSetting(settings.startup?.runOnLogin ?? false)
  createWindow()
  startFileWatcher()
  startSyncTimer()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
