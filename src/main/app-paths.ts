import { app } from 'electron'
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'

let appRoot: string | null = null

export function getAppRoot(): string {
  if (appRoot) return appRoot

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

function getBundledResourceDir(name: string): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, name)
  }
  return join(getAppRoot(), 'resources', name)
}

export function getBundledLogosPath(): string {
  return getBundledResourceDir('logos')
}

export function getBundledBrandingPath(): string {
  return getBundledResourceDir('branding')
}

function getUserDataRoot(): string {
  return join(app.getPath('userData'), 'data')
}

function migrateLegacyDataDir(root: string): void {
  const legacy = join(root, 'data')
  const target = getUserDataRoot()
  if (!existsSync(legacy)) return

  mkdirSync(target, { recursive: true })
  for (const entry of readdirSync(legacy, { withFileTypes: true })) {
    const src = join(legacy, entry.name)
    const dest = join(target, entry.name)
    if (!existsSync(dest)) {
      cpSync(src, dest, { recursive: true })
    }
  }
  rmSync(legacy, { recursive: true, force: true })
}

function cleanupLegacyPortableDirs(root: string): void {
  for (const dir of ['mcps', 'logos', 'data']) {
    const full = join(root, dir)
    if (existsSync(full)) {
      rmSync(full, { recursive: true, force: true })
    }
  }
}

export function ensurePortableLayout(): void {
  const root = getAppRoot()

  migrateLegacyDataDir(root)
  cleanupLegacyPortableDirs(root)

  const dirs = [
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

  const userDataDirs = [
    'hub-cache',
    'hub-cache/skills',
    'hub-cache/rules',
    'hub-cache/mcps',
    'hub-cache/hooks',
    'hub-cache/tools',
    'repo-bank'
  ]
  const dataRoot = getUserDataRoot()
  for (const dir of userDataDirs) {
    const full = join(dataRoot, dir)
    if (!existsSync(full)) {
      mkdirSync(full, { recursive: true })
    }
  }

  const importedPath = join(root, 'imported-projects.json')
  if (!existsSync(importedPath)) {
    writeFileSync(importedPath, `${JSON.stringify({ projectRoots: [] }, null, 2)}\n`, 'utf-8')
  }

  const categoriesPath = getCategoriesPath()
  if (!existsSync(categoriesPath)) {
    writeFileSync(
      categoriesPath,
      `${JSON.stringify({ skills: {}, rules: {} }, null, 2)}\n`,
      'utf-8'
    )
  }
}

export function getDataPath(settingsDataPath = './data'): string {
  const normalized = settingsDataPath.replace(/^\.\//, '')
  if (normalized === 'data') {
    return getUserDataRoot()
  }
  return resolveFromAppRoot(normalized)
}

export function getLogosPath(): string {
  return getBundledLogosPath()
}

export function getBrandingPath(): string {
  return getBundledBrandingPath()
}

export function getSettingsPath(): string {
  return resolveFromAppRoot('settings.json')
}

export function getImportedProjectsPath(): string {
  return resolveFromAppRoot('imported-projects.json')
}

export function getCategoriesPath(): string {
  return resolveFromAppRoot('categories.json')
}

export function getTrashPath(...segments: string[]): string {
  return resolveFromAppRoot('.trash', ...segments)
}
