import { existsSync } from 'fs'
import { join } from 'path'
import type { PlatformId } from '@shared/types'
import { PLATFORM_IDS } from '@shared/types'
import { getProjectDotDir } from '../platforms/types'
import { fileService } from './file.service'
import { settingsStore } from './settings-store'

export class ProjectBootstrapService {
  /** Scaffold folders for the given platforms (defaults to all PLATFORM_IDS). */
  async bootstrapProject(
    projectPath: string,
    platformIds: PlatformId[] = PLATFORM_IDS
  ): Promise<void> {
    for (const platformId of platformIds) {
      await this.ensurePlatformFolders(projectPath, platformId)
    }
  }

  async bootstrapProjects(
    projectPaths: string[],
    platformIds?: PlatformId[]
  ): Promise<void> {
    for (const projectPath of projectPaths) {
      await this.bootstrapProject(projectPath, platformIds)
    }
  }

  /** Scaffold folders for every currently enabled platform across all imported projects. */
  async bootstrapEnabledPlatformsForAllProjects(): Promise<void> {
    const settings = settingsStore.get()
    const enabledIds = settings.platforms.filter((p) => p.enabled).map((p) => p.id)
    const projectPaths = settings.projectRoots.flatMap((r) => r.projects.map((p) => p.path))
    await this.bootstrapProjects(projectPaths, enabledIds)
  }

  async ensurePlatformFolders(projectPath: string, platformId: PlatformId): Promise<void> {
    const dotDir = getProjectDotDir(platformId, projectPath)
    await fileService.writeText(join(dotDir, 'skills', '.keep'), '')
    await fileService.writeText(join(dotDir, 'rules', '.keep'), '')
    await fileService.writeText(join(dotDir, 'tools', '.keep'), '')

    if (platformId === 'cursor') {
      await fileService.writeText(join(dotDir, 'hooks', '.keep'), '')
      await fileService.writeText(join(dotDir, 'agents', '.keep'), '')
      const hooksJson = join(dotDir, 'hooks.json')
      if (!existsSync(hooksJson)) {
        await fileService.writeText(hooksJson, JSON.stringify({ hooks: {} }, null, 2))
      }
    }
  }
}

export const projectBootstrapService = new ProjectBootstrapService()
