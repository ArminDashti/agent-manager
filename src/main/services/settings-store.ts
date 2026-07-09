import { existsSync, readFileSync, writeFileSync } from 'fs'
import { createDefaultSettings } from '@shared/defaults'
import type { AppSettings } from '@shared/types'
import { getSettingsPath } from '../app-paths'

let cached: AppSettings | null = null

export class SettingsStore {
  load(): AppSettings {
    if (cached) return cached

    const path = getSettingsPath()
    if (existsSync(path)) {
      try {
        const raw = readFileSync(path, 'utf-8')
        cached = { ...createDefaultSettings(), ...JSON.parse(raw) }
        return cached!
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
