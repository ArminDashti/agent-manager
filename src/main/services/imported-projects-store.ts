import { existsSync, readFileSync, writeFileSync } from 'fs'
import type { ProjectRootConfig } from '@shared/types'
import { getImportedProjectsPath } from '../app-paths'

export interface ImportedProjectsFile {
  projectRoots: ProjectRootConfig[]
}

let cached: ProjectRootConfig[] | null = null

function emptyFile(): ImportedProjectsFile {
  return { projectRoots: [] }
}

export class ImportedProjectsStore {
  load(): ProjectRootConfig[] {
    if (cached) return cached

    const path = getImportedProjectsPath()
    if (existsSync(path)) {
      try {
        const raw = readFileSync(path, 'utf-8')
        const parsed = JSON.parse(raw) as ImportedProjectsFile
        cached = Array.isArray(parsed.projectRoots) ? parsed.projectRoots : []
        return cached
      } catch {
        cached = []
        return cached
      }
    }

    cached = []
    this.persist(cached)
    return cached
  }

  get(): ProjectRootConfig[] {
    return this.load()
  }

  save(projectRoots: ProjectRootConfig[]): ProjectRootConfig[] {
    cached = projectRoots
    this.persist(cached)
    return cached
  }

  update(mutator: (roots: ProjectRootConfig[]) => ProjectRootConfig[]): ProjectRootConfig[] {
    const next = mutator(this.load())
    return this.save(next)
  }

  /** Seed from legacy settings.projectRoots when the dedicated file is empty. */
  migrateFromSettings(legacyRoots: ProjectRootConfig[]): boolean {
    this.load()
    if ((cached?.length ?? 0) > 0) return false
    if (!legacyRoots || legacyRoots.length === 0) return false
    this.save(legacyRoots)
    return true
  }

  private persist(projectRoots: ProjectRootConfig[]): void {
    const payload: ImportedProjectsFile = { projectRoots }
    writeFileSync(getImportedProjectsPath(), JSON.stringify(payload, null, 2), 'utf-8')
  }
}

export const importedProjectsStore = new ImportedProjectsStore()

export { emptyFile as emptyImportedProjectsFile }
