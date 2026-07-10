import simpleGit, { SimpleGit } from 'simple-git'
import { existsSync } from 'fs'
import { mkdir } from 'fs/promises'
import { join } from 'path'
import { getDataPath } from '../app-paths'
import { settingsStore } from './settings-store'
import { fileService } from './file.service'

export class RepoBankService {
  private gitFor(path: string): SimpleGit {
    return simpleGit(path)
  }

  async ensureClone(): Promise<string> {
    const settings = settingsStore.get()
    const clonePath = join(getDataPath(settings.dataPath), 'repo-bank')
    await mkdir(clonePath, { recursive: true })

    if (!existsSync(join(clonePath, '.git'))) {
      if (settings.repoBank.url) {
        await simpleGit().clone(settings.repoBank.url, clonePath)
      }
    }

    return clonePath
  }

  async fetch(pat?: string): Promise<string> {
    const clonePath = await this.ensureClone()
    const git = this.gitFor(clonePath)
    if (pat) {
      await git.pull('origin', 'main')
    } else {
      await git.pull()
    }

    settingsStore.update((s) => ({
      ...s,
      repoBank: { ...s.repoBank, lastFetchAt: new Date().toISOString() }
    }))

    return clonePath
  }

  async commitAndPush(message: string, pat?: string): Promise<void> {
    const clonePath = await this.ensureClone()
    const git = this.gitFor(clonePath)
    await git.add('.')
    const status = await git.status()
    if (status.files.length === 0) return
    await git.commit(message || 'Janus backup')
    await git.push()

    settingsStore.update((s) => ({
      ...s,
      repoBank: { ...s.repoBank, lastPushAt: new Date().toISOString() }
    }))
  }

  async writeResourceFile(
    resourceType: 'skill' | 'rule' | 'hook' | 'subAgent',
    name: string,
    relativePath: string,
    content: string
  ): Promise<string> {
    const clonePath = await this.ensureClone()
    const typeDir =
      resourceType === 'skill'
        ? 'skills'
        : resourceType === 'rule'
          ? 'rules'
          : resourceType === 'hook'
            ? 'hooks'
            : 'agents'
    const dest =
      resourceType === 'hook'
        ? join(clonePath, typeDir, relativePath)
        : join(clonePath, typeDir, name, relativePath)
    await fileService.writeText(dest, content)
    return dest
  }
}

export const repoBankService = new RepoBankService()
