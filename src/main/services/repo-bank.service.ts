import simpleGit, { SimpleGit } from 'simple-git'
import { existsSync } from 'fs'
import { mkdir } from 'fs/promises'
import { join } from 'path'
import { getDataPath } from '../app-paths'
import { settingsStore } from './settings-store'
import { fileService } from './file.service'
import { withPatInGitUrl } from './github.service'

export class RepoBankService {
  private gitFor(path: string): SimpleGit {
    return simpleGit(path)
  }

  private getPat(): string {
    return settingsStore.get().github?.pat ?? ''
  }

  async ensureClone(): Promise<string> {
    const settings = settingsStore.get()
    const clonePath = join(getDataPath(settings.dataPath), 'repo-bank')
    await mkdir(clonePath, { recursive: true })

    if (!existsSync(join(clonePath, '.git'))) {
      if (settings.repoBank.url) {
        const url = withPatInGitUrl(settings.repoBank.url, this.getPat())
        await simpleGit().clone(url, clonePath)
      }
    }

    return clonePath
  }

  async fetch(): Promise<string> {
    const settings = settingsStore.get()
    const clonePath = await this.ensureClone()
    const git = this.gitFor(clonePath)

    const pat = this.getPat()
    if (pat && settings.repoBank.url) {
      const remoteUrl = withPatInGitUrl(settings.repoBank.url, pat)
      await git.removeRemote('origin').catch(() => undefined)
      await git.addRemote('origin', remoteUrl)
    }

    await git.pull()

    settingsStore.update((s) => ({
      ...s,
      repoBank: { ...s.repoBank, lastFetchAt: new Date().toISOString() }
    }))

    return clonePath
  }

  async commitAndPush(message: string): Promise<void> {
    const settings = settingsStore.get()
    const clonePath = await this.ensureClone()
    const git = this.gitFor(clonePath)

    const pat = this.getPat()
    if (pat && settings.repoBank.url) {
      const remoteUrl = withPatInGitUrl(settings.repoBank.url, pat)
      await git.removeRemote('origin').catch(() => undefined)
      await git.addRemote('origin', remoteUrl)
    }

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
