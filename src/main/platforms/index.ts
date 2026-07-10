import { join } from 'path'
import type { PlatformAdapter } from './types'
import { createBasePaths } from './types'

function makeAdapter(
  id: PlatformAdapter['id'],
  label: string,
  hooksAndAgents: boolean,
  extraSkillsDir?: string
): PlatformAdapter {
  const supportedResources: PlatformAdapter['supportedResources'] = hooksAndAgents
    ? ['skill', 'rule', 'mcp', 'hook', 'subAgent', 'tool']
    : ['skill', 'rule', 'mcp', 'tool']

  return {
    id,
    label,
    supportedResources,
    getPlatformPaths(rootPath: string) {
      const paths = createBasePaths(rootPath, hooksAndAgents)
      if (extraSkillsDir) {
        paths.skillsDirs.push(join(rootPath, extraSkillsDir))
      }
      return paths
    },
    getProjectPaths(projectPath: string) {
      const dotDir =
        id === 'cursor'
          ? join(projectPath, '.cursor')
          : id === 'cline'
            ? join(projectPath, '.cline')
            : join(projectPath, `.${id}`)
      return createBasePaths(dotDir, hooksAndAgents)
    }
  }
}

export const cursorAdapter = makeAdapter('cursor', 'Cursor', true, 'skills-cursor')
export const clineAdapter = makeAdapter('cline', 'Cline', false)
export const kiloAdapter = makeAdapter('kilo', 'Kilo', false)
export const antigravityAdapter = makeAdapter('antigravity', 'Antigravity', false)
export const devinAdapter = makeAdapter('devin', 'Devin', false)
export const kiroAdapter = makeAdapter('kiro', 'Kiro', false)
export const hermesAdapter = makeAdapter('hermes', 'Hermes', false)
export const copilotAdapter = makeAdapter('copilot', 'Copilot', false)

export const allAdapters = [
  antigravityAdapter,
  clineAdapter,
  copilotAdapter,
  cursorAdapter,
  devinAdapter,
  hermesAdapter,
  kiloAdapter,
  kiroAdapter
]

export function getAdapter(id: string): PlatformAdapter | undefined {
  return allAdapters.find((a) => a.id === id)
}
