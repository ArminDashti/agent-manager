import { existsSync, readFileSync, writeFileSync } from 'fs'
import { createDefaultSettings } from '@shared/defaults'
import type { AppSettings } from '@shared/types'
import { ruleDisplayName } from '@shared/rule-names'
import { getSettingsPath } from '../app-paths'

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

  return merged
}

export class SettingsStore {
  load(): AppSettings {
    if (cached) return cached

    const path = getSettingsPath()
    if (existsSync(path)) {
      try {
        const raw = readFileSync(path, 'utf-8')
        cached = migrateSettings(JSON.parse(raw) as AppSettings)
        return cached
      } catch {
        cached = createDefaultSettings()
        return cached
      }
    }

    cached = createDefaultSettings()
    this.save(cached)
    return cached
  }

  save(settings: AppSettings): void {
    cached = settings
    writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf-8')
  }

  update(mutator: (settings: AppSettings) => AppSettings): AppSettings {
    const next = mutator(this.load())
    this.save(next)
    return next
  }

  get(): AppSettings {
    return this.load()
  }
}

export const settingsStore = new SettingsStore()
