import { existsSync } from 'fs'
import { join } from 'path'
import { PLATFORM_IDS } from '@shared/types'
import { getProjectDotDir } from '../platforms/types'
import { fileService } from './file.service'

export class ProjectBootstrapService {
  async bootstrapProject(projectPath: string): Promise<void> {
    for (const platformId of PLATFORM_IDS) {
      const dotDir = getProjectDotDir(platformId, projectPath)
      await fileService.writeText(join(dotDir, 'skills', '.keep'), '')
      await fileService.writeText(join(dotDir, 'rules', '.keep'), '')

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

  async bootstrapProjects(projectPaths: string[]): Promise<void> {
    for (const projectPath of projectPaths) {
      await this.bootstrapProject(projectPath)
    }
  }
}

export const projectBootstrapService = new ProjectBootstrapService()
