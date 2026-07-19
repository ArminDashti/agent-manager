import { app } from 'electron'
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'fs'
import { join } from 'path'

let appRoot: string | null = null

export function getAppRoot(): string {
  if (appRoot) return appRoot

  // electron-builder portable unpacks to %TEMP%; persist next to the real .exe instead.
  const portableDir = process.env.PORTABLE_EXECUTABLE_DIR
  if (portableDir) {
    appRoot = portableDir
  } else if (app.isPackaged) {
    appRoot = join(app.getPath('exe'), '..')
  } else {
    appRoot = process.cwd()
  }

  return appRoot
}

export function resolveFromAppRoot(...segments: string[]): string {
  return join(getAppRoot(), ...segments)
}

export function ensurePortableLayout(): void {
  const root = getAppRoot()
  const dirs = [
    'data',
    'data/hub-cache',
    'data/hub-cache/skills',
    'data/hub-cache/rules',
    'data/hub-cache/mcps',
    'data/hub-cache/hooks',
    'data/hub-cache/tools',
    'data/repo-bank',
    'mcps',
    'logos',
    '.trash',
    '.trash/skills',
    '.trash/rules',
    '.trash/hooks',
    '.trash/subAgents',
    '.trash/tools'
  ]

  for (const dir of dirs) {
    const full = join(root, dir)
    if (!existsSync(full)) {
      mkdirSync(full, { recursive: true })
    }
  }

  const importedPath = join(root, 'imported-projects.json')
  if (!existsSync(importedPath)) {
    writeFileSync(importedPath, `${JSON.stringify({ projectRoots: [] }, null, 2)}\n`, 'utf-8')
  }

  seedLogos(root)
}

function seedLogos(root: string): void {
  const logosDir = join(root, 'logos')
  const bundled = app.isPackaged
    ? join(process.resourcesPath, 'logos')
    : join(root, 'resources', 'logos')

  if (!existsSync(bundled)) return

  for (const file of readdirSync(bundled)) {
    const dest = join(logosDir, file)
    if (!existsSync(dest)) {
      copyFileSync(join(bundled, file), dest)
    }
  }
}

export function getDataPath(settingsDataPath = './data'): string {
  const normalized = settingsDataPath.replace(/^\.\//, '')
  return resolveFromAppRoot(normalized)
}

export function getLogosPath(): string {
  return resolveFromAppRoot('logos')
}

export function getSettingsPath(): string {
  return resolveFromAppRoot('settings.json')
}

export function getImportedProjectsPath(): string {
  return resolveFromAppRoot('imported-projects.json')
}

export function getTrashPath(...segments: string[]): string {
  return resolveFromAppRoot('.trash', ...segments)
}
