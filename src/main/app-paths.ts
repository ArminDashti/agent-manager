import { app } from 'electron'
import { cpSync, existsSync, mkdirSync, copyFileSync, readdirSync } from 'fs'
import { join } from 'path'

let appRoot: string | null = null

export function getAppRoot(): string {
  if (appRoot) return appRoot

  if (app.isPackaged) {
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
    'caches/skills',
    'caches/hooks',
    'caches/rules',
    'caches/agents',
    'mcps',
    'logos'
  ]

  for (const dir of dirs) {
    const full = join(root, dir)
    if (!existsSync(full)) {
      mkdirSync(full, { recursive: true })
    }
  }

  migrateMdFilesToCaches(root)
  seedLogos(root)
}

function migrateMdFilesToCaches(root: string): void {
  const legacy = join(root, 'md-files')
  const caches = join(root, 'caches')
  if (!existsSync(legacy) || !existsSync(caches)) return

  const legacyHasContent = readdirSync(legacy).length > 0
  const cachesEmpty =
    ['skills', 'hooks', 'rules', 'agents'].every((sub) => {
      const dir = join(caches, sub)
      return !existsSync(dir) || readdirSync(dir).length === 0
    }) && readdirSync(caches).every((name) => ['skills', 'hooks', 'rules', 'agents'].includes(name))

  if (!legacyHasContent || !cachesEmpty) return

  for (const sub of ['skills', 'hooks', 'rules']) {
    const src = join(legacy, sub)
    const dest = join(caches, sub)
    if (existsSync(src)) {
      cpSync(src, dest, { recursive: true })
    }
  }
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

export function getCachesPath(): string {
  return resolveFromAppRoot('caches')
}
