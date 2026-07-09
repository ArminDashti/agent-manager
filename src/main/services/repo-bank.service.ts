import simpleGit, { SimpleGit } from 'simple-git'
import { existsSync } from 'fs'
import { mkdir } from 'fs/promises'
import { join } from 'path'
import { getDataPath } from '../app-paths'
import { settingsStore } from './settings-store'

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
    await git.commit(message || 'Agent Manager backup')
    await git.push()

    settingsStore.update((s) => ({
      ...s,
      repoBank: { ...s.repoBank, lastPushAt: new Date().toISOString() }
    }))
  }
}

export const repoBankService = new RepoBankService()
