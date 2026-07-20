import { existsSync, readFileSync, writeFileSync } from 'fs'
import type { AppSettings } from '@shared/types'
import { ruleDisplayName } from '@shared/rule-names'
import { getCategoriesPath } from '../app-paths'

export interface CategoriesFile {
  skills: Record<string, string>
  rules: Record<string, string>
}

let cached: CategoriesFile | null = null

function emptyFile(): CategoriesFile {
  return { skills: {}, rules: {} }
}

function migrateRuleKeys(map: Record<string, string>): Record<string, string> {
  const next: Record<string, string> = {}
  for (const [key, value] of Object.entries(map)) {
    const newKey = key.endsWith('.mdc') ? ruleDisplayName(key) : key
    next[newKey] = value
  }
  return next
}

export class CategoriesStore {
  load(): CategoriesFile {
    if (cached) return cached

    const path = getCategoriesPath()
    if (existsSync(path)) {
      try {
        const raw = readFileSync(path, 'utf-8')
        const parsed = JSON.parse(raw) as Partial<CategoriesFile>
        cached = {
          skills: parsed.skills ?? {},
          rules: migrateRuleKeys(parsed.rules ?? {})
        }
        return cached
      } catch {
        cached = emptyFile()
        return cached
      }
    }

    cached = emptyFile()
    this.persist(cached)
    return cached
  }

  get(): CategoriesFile {
    return this.load()
  }

  save(categories: CategoriesFile): CategoriesFile {
    cached = categories
    this.persist(cached)
    return cached
  }

  update(mutator: (categories: CategoriesFile) => CategoriesFile): CategoriesFile {
    const next = mutator(this.load())
    return this.save(next)
  }

  getCategory(resourceType: 'skill' | 'rule', name: string): string {
    const key = resourceType === 'skill' ? 'skills' : 'rules'
    return this.get()[key][name] ?? ''
  }

  setCategory(resourceType: 'skill' | 'rule', name: string, category: string): void {
    const key = resourceType === 'skill' ? 'skills' : 'rules'
    this.update((cats) => ({
      ...cats,
      [key]: {
        ...cats[key],
        [name]: category.trim()
      }
    }))
  }

  removeCategory(resourceType: 'skill' | 'rule', name: string): void {
    const key = resourceType === 'skill' ? 'skills' : 'rules'
    this.update((cats) => {
      const next = { ...cats[key] }
      delete next[name]
      return { ...cats, [key]: next }
    })
  }

  renameCategory(resourceType: 'skill' | 'rule', oldName: string, newName: string): void {
    const key = resourceType === 'skill' ? 'skills' : 'rules'
    this.update((cats) => {
      const next = { ...cats[key] }
      if (next[oldName] !== undefined) {
        next[newName] = next[oldName]
        delete next[oldName]
      }
      return { ...cats, [key]: next }
    })
  }

  mergeDerivedSkills(derived: Record<string, string>): void {
    if (Object.keys(derived).length === 0) return
    this.update((cats) => ({
      ...cats,
      skills: { ...cats.skills, ...derived }
    }))
  }

  migrateFromSettings(legacy: AppSettings['resourceCategories'] | undefined): boolean {
    this.load()
    const hasData =
      Object.keys(cached?.skills ?? {}).length > 0 ||
      Object.keys(cached?.rules ?? {}).length > 0
    if (hasData) return false
    if (!legacy) return false

    const skills = legacy.skills ?? {}
    const rules = migrateRuleKeys(legacy.rules ?? {})
    if (Object.keys(skills).length === 0 && Object.keys(rules).length === 0) return false

    this.save({ skills, rules })
    return true
  }

  toAppSettingsShape(): AppSettings['resourceCategories'] {
    const cats = this.get()
    return { skills: { ...cats.skills }, rules: { ...cats.rules } }
  }

  private persist(categories: CategoriesFile): void {
    writeFileSync(getCategoriesPath(), `${JSON.stringify(categories, null, 2)}\n`, 'utf-8')
  }
}

export const categoriesStore = new CategoriesStore()
