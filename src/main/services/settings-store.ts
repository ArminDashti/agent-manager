import { existsSync, readFileSync, writeFileSync } from 'fs'
import { createDefaultSettings } from '@shared/defaults'
import type { AppSettings } from '@shared/types'
import { PLATFORM_IDS } from '@shared/types'
import { ruleDisplayName } from '@shared/rule-names'
import { getSettingsPath } from '../app-paths'
import { importedProjectsStore } from './imported-projects-store'
import { categoriesStore } from './categories-store'

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

  const knownIds = new Set<string>(PLATFORM_IDS)
  merged.platforms = merged.platforms.filter((p) => knownIds.has(p.id))
  for (const id of PLATFORM_IDS) {
    if (!merged.platforms.some((p) => p.id === id)) {
      const defaultPlatform = defaults.platforms.find((p) => p.id === id)
      if (defaultPlatform) merged.platforms.push(defaultPlatform)
    }
  }
  // Product rule: only Cursor is enabled; Settings Platforms UI is frozen to Cursor.
  merged.platforms = merged.platforms.map((p) => {
    if (p.id === 'cursor') {
      return {
        ...p,
        enabled: true,
        rootPath: p.rootPath.trim() || defaults.platforms.find((d) => d.id === 'cursor')!.rootPath
      }
    }
    return { ...p, enabled: false }
  })

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

function withCategories(settings: AppSettings): AppSettings {
  return {
    ...settings,
    resourceCategories: categoriesStore.toAppSettingsShape()
  }
}

function stripPersistedFields(settings: AppSettings): AppSettings {
  const { projectRoots: _roots, resourceCategories: _cats, ...rest } = settings
  return { ...rest, projectRoots: [], resourceCategories: { skills: {}, rules: {} } }
}

export class SettingsStore {
  load(): AppSettings {
    if (cached) return withCategories(withImportedProjects(cached))

    const path = getSettingsPath()
    if (existsSync(path)) {
      try {
        const raw = readFileSync(path, 'utf-8')
        const parsed = JSON.parse(raw) as AppSettings
        const loaded = migrateSettings(parsed)

        const legacyRoots = parsed.projectRoots ?? []
        importedProjectsStore.migrateFromSettings(legacyRoots)

        const categoriesMigrated = categoriesStore.migrateFromSettings(
          parsed.resourceCategories
        )

        cached = stripPersistedFields(loaded)

        const platformsMigrated = JSON.stringify(parsed.platforms) !== JSON.stringify(cached.platforms)
        if (legacyRoots.length > 0 || categoriesMigrated || platformsMigrated) {
          writeFileSync(getSettingsPath(), `${JSON.stringify(cached, null, 2)}\n`, 'utf-8')
        }

        return withCategories(withImportedProjects(cached))
      } catch {
        cached = createDefaultSettings()
        return withCategories(withImportedProjects(cached))
      }
    }

    cached = createDefaultSettings()
    this.persistDisk(cached)
    return withCategories(withImportedProjects(cached))
  }

  save(settings: AppSettings): void {
    cached = stripPersistedFields(migrateSettings(settings))
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
    writeFileSync(
      getSettingsPath(),
      `${JSON.stringify(stripPersistedFields(settings), null, 2)}\n`,
      'utf-8'
    )
  }
}

export const settingsStore = new SettingsStore()
