import { existsSync, readFileSync, writeFileSync } from 'fs'
import { createDefaultSettings } from '@shared/defaults'
import type { AppSettings } from '@shared/types'
import { PLATFORM_IDS } from '@shared/types'
import { ruleDisplayName } from '@shared/rule-names'
import { getSettingsPath } from '../app-paths'
import { importedProjectsStore } from './imported-projects-store'

let cached: AppSettings | null = null

function migrateRuleKeys<T>(map: Record<string, T>): Record<string, T> {
  const next: Record<string, T> = {}
  for (const [key, value] of Object.entries(map)) {
    const newKey = key.endsWith('.mdc') ? ruleDisplayName(key) : key
    next[newKey] = value
  }
  return next
}

function migrateSettings(settings: AppSettings): AppSettings {
  const defaults = createDefaultSettings()
  const merged = { ...defaults, ...settings }

  merged.mandatoryForAllProjects = {
    ...defaults.mandatoryForAllProjects,
    ...settings.mandatoryForAllProjects,
    rules: migrateRuleKeys({
      ...defaults.mandatoryForAllProjects.rules,
      ...(settings.mandatoryForAllProjects?.rules ?? {})
    })
  }

  merged.resourceCategories = {
    skills: {
      ...defaults.resourceCategories.skills,
      ...(settings.resourceCategories?.skills ?? {})
    },
    rules: migrateRuleKeys({
      ...defaults.resourceCategories.rules,
      ...(settings.resourceCategories?.rules ?? {})
    })
  }

  const knownIds = new Set<string>(PLATFORM_IDS)
  merged.platforms = merged.platforms.filter((p) => knownIds.has(p.id))
  for (const id of PLATFORM_IDS) {
    if (!merged.platforms.some((p) => p.id === id)) {
      const defaultPlatform = defaults.platforms.find((p) => p.id === id)
      if (defaultPlatform) merged.platforms.push(defaultPlatform)
    }
  }

  merged.uiFilters = {
    ...defaults.uiFilters,
    ...(settings.uiFilters ?? {})
  }

  merged.github = {
    ...defaults.github,
    ...(settings.github ?? {})
  }

  merged.openRouter = {
    ...defaults.openRouter,
    ...(settings.openRouter ?? {})
  }

  return merged
}

function withImportedProjects(settings: AppSettings): AppSettings {
  return {
    ...settings,
    projectRoots: importedProjectsStore.get()
  }
}

function stripProjectRoots(settings: AppSettings): AppSettings {
  return {
    ...settings,
    projectRoots: []
  }
}

export class SettingsStore {
  load(): AppSettings {
    if (cached) return withImportedProjects(cached)

    const path = getSettingsPath()
    if (existsSync(path)) {
      try {
        const raw = readFileSync(path, 'utf-8')
        const loaded = migrateSettings(JSON.parse(raw) as AppSettings)
        const legacyRoots = loaded.projectRoots ?? []
        const migrated = importedProjectsStore.migrateFromSettings(legacyRoots)
        if (migrated || legacyRoots.length > 0) {
          // Keep projectRoots out of settings.json once the dedicated file owns them.
          cached = stripProjectRoots(loaded)
          writeFileSync(getSettingsPath(), JSON.stringify(cached, null, 2), 'utf-8')
        } else {
          cached = stripProjectRoots(loaded)
        }
        return withImportedProjects(cached)
      } catch {
        cached = createDefaultSettings()
        return withImportedProjects(cached)
      }
    }

    cached = createDefaultSettings()
    this.persistDisk(cached)
    return withImportedProjects(cached)
  }

  save(settings: AppSettings): void {
    // Never persist projectRoots into settings.json — imported-projects.json owns them.
    // Also ignore any stale projectRoots from the renderer so saveSettings cannot wipe imports.
    cached = stripProjectRoots(settings)
    this.persistDisk(cached)
  }

  update(mutator: (settings: AppSettings) => AppSettings): AppSettings {
    const next = mutator(this.get())
    this.save(next)
    return this.get()
  }

  get(): AppSettings {
    return this.load()
  }

  private persistDisk(settings: AppSettings): void {
    writeFileSync(getSettingsPath(), JSON.stringify(stripProjectRoots(settings), null, 2), 'utf-8')
  }
}

export const settingsStore = new SettingsStore()
