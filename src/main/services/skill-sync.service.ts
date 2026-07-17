import { existsSync } from 'fs'
import { join, resolve } from 'path'
import { getAdapter } from '../platforms'
import { fileService } from './file.service'
import { settingsStore } from './settings-store'

const syncingRoots = new Set<string>()
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>()

function normalizePath(p: string): string {
  return resolve(p).replace(/\\/g, '/').toLowerCase()
}

function isUnderSyncingRoot(changedPath: string): boolean {
  const n = normalizePath(changedPath)
  for (const root of syncingRoots) {
    if (n === root || n.startsWith(`${root}/`)) return true
  }
  return false
}

export function resolveSkillFromPath(
  changedPath: string
): { skillName: string; sourceRoot: string } | null {
  const settings = settingsStore.get()
  const abs = resolve(changedPath)
  const normalizedAbs = normalizePath(abs)

  for (const root of settings.projectRoots) {
    for (const project of root.projects) {
      for (const platform of settings.platforms) {
        if (!platform.enabled) continue
        const adapter = getAdapter(platform.id)
        if (!adapter) continue
        const paths = adapter.getProjectPaths(project.path)
        for (const skillsDir of paths.skillsDirs) {
          const skillsDirResolved = resolve(skillsDir)
          const skillsDirNorm = normalizePath(skillsDirResolved)
          if (
            normalizedAbs !== skillsDirNorm &&
            !normalizedAbs.startsWith(`${skillsDirNorm}/`)
          ) {
            continue
          }
          const rel = abs.slice(skillsDirResolved.length).replace(/^[/\\]+/, '')
          const skillName = rel.split(/[/\\]/)[0]
          if (!skillName) continue
          const sourceRoot = join(skillsDirResolved, skillName)
          if (!existsSync(join(sourceRoot, 'SKILL.md'))) continue
          return { skillName, sourceRoot }
        }
      }
    }
  }
  return null
}

function collectOtherSkillRoots(skillName: string, sourceRoot: string): string[] {
  const settings = settingsStore.get()
  const sourceNorm = normalizePath(sourceRoot)
  const destRoots: string[] = []

  for (const root of settings.projectRoots) {
    for (const project of root.projects) {
      for (const platform of settings.platforms) {
        if (!platform.enabled) continue
        const adapter = getAdapter(platform.id)
        if (!adapter) continue
        const paths = adapter.getProjectPaths(project.path)
        for (const skillsDir of paths.skillsDirs) {
          const dest = join(skillsDir, skillName)
          if (!existsSync(join(dest, 'SKILL.md'))) continue
          if (normalizePath(dest) === sourceNorm) continue
          destRoots.push(dest)
        }
      }
    }
  }

  return destRoots
}

async function syncSkillFromResolved(skillName: string, sourceRoot: string): Promise<void> {
  if (!existsSync(join(sourceRoot, 'SKILL.md'))) return

  const destRoots = collectOtherSkillRoots(skillName, sourceRoot)
  if (destRoots.length === 0) return

  const norms = destRoots.map((d) => normalizePath(d))
  for (const n of norms) syncingRoots.add(n)

  try {
    for (const dest of destRoots) {
      await fileService.removePath(dest)
      await fileService.copyDirectory(sourceRoot, dest)
    }
  } finally {
    setTimeout(() => {
      for (const n of norms) syncingRoots.delete(n)
    }, 2500)
  }
}

/** Debounced fan-out: copy the changed skill folder to every other project that already has it. */
export function scheduleSkillSyncFromPath(changedPath: string): void {
  if (isUnderSyncingRoot(changedPath)) return

  const resolved = resolveSkillFromPath(changedPath)
  if (!resolved) return

  const key = normalizePath(resolved.sourceRoot)
  const existing = pendingTimers.get(key)
  if (existing) clearTimeout(existing)

  pendingTimers.set(
    key,
    setTimeout(() => {
      pendingTimers.delete(key)
      void syncSkillFromResolved(resolved.skillName, resolved.sourceRoot)
    }, 800)
  )
}
