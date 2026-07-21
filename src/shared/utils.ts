import { createHash } from 'crypto'
import { homedir } from 'os'
import { join } from 'path'

export {
  isMarkdownFile,
  parseFrontmatter,
  defaultCategoryFromName,
  HUB_TYPE_FOLDERS,
  skillGroupKey,
  parseSkillGroupKey,
  skillFolderNameFromKey
} from './utils.browser'

export function expandHome(input: string): string {
  if (input.startsWith('~/')) {
    return join(homedir(), input.slice(2))
  }
  if (input === '~') {
    return homedir()
  }
  return input
}

export function stableId(...parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16)
}

/** Full sha256 hex of SKILL.md text (identity for same-name skill variants). */
export function skillContentHash(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

export function basename(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  return normalized.split('/').filter(Boolean).pop() ?? path
}
