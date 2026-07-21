export function isMarkdownFile(path: string): boolean {
  return /\.(md|mdc)$/i.test(path)
}

const BLOCK_SCALAR_RE = /^(>|>-|\||\|-)\s*$/

function isIndentedContinuation(line: string): boolean {
  return line.length > 0 && /^\s/.test(line)
}

function joinBlockScalar(style: string, lines: string[]): string {
  const trimmed = lines.map((l) => l.replace(/^\s+/, ''))
  if (style.startsWith('>')) {
    return trimmed.join(' ').replace(/\s+/g, ' ').trim()
  }
  return trimmed.join('\n').trim()
}

export function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown>
  body: string
} {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) {
    return { frontmatter: {}, body: content }
  }

  const frontmatter: Record<string, unknown> = {}
  const lines = match[1].split(/\r?\n/)
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const idx = line.indexOf(':')
    if (idx === -1) {
      i++
      continue
    }

    const key = line.slice(0, idx).trim()
    if (!key) {
      i++
      continue
    }

    let value: unknown = line.slice(idx + 1).trim()
    if (typeof value === 'string' && BLOCK_SCALAR_RE.test(value)) {
      const style = value
      const blockLines: string[] = []
      i++
      while (i < lines.length && isIndentedContinuation(lines[i])) {
        blockLines.push(lines[i])
        i++
      }
      value = joinBlockScalar(style, blockLines)
      frontmatter[key] = value
      continue
    }

    if (value === 'true') value = true
    else if (value === 'false') value = false
    frontmatter[key] = value
    i++
  }

  return { frontmatter, body: match[2] }
}

/** First segment before `-`, e.g. `git-local-commit` → `git`. Empty if no hyphen. */
export function defaultCategoryFromName(name: string): string {
  const idx = name.indexOf('-')
  if (idx <= 0) return ''
  return name.slice(0, idx).trim()
}

export const HUB_TYPE_FOLDERS: Record<string, string> = {
  skill: 'skills',
  rule: 'rules',
  mcp: 'mcps',
  hook: 'hooks',
  tool: 'tools'
}

export function formatDateWithRelative(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'

  const formatted = date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (diffDays === 0) return `${formatted} (today)`
  if (diffDays === 1) return `${formatted} (1 day ago)`
  return `${formatted} (${diffDays} days ago)`
}

export function isValidGithubUrl(url: string): boolean {
  const trimmed = url.trim()
  if (!trimmed) return false
  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === 'https:' && parsed.hostname === 'github.com'
  } catch {
    return false
  }
}

export function skillGroupKey(name: string, contentHash: string): string {
  return `${name}::${contentHash}`
}

/** Parse `name::contentHash` group keys; returns null for bare folder names. */
export function parseSkillGroupKey(
  key: string
): { name: string; contentHash: string } | null {
  const sep = key.lastIndexOf('::')
  if (sep <= 0) return null
  const contentHash = key.slice(sep + 2).toLowerCase()
  if (!/^[a-f0-9]{64}$/.test(contentHash)) return null
  return { name: key.slice(0, sep), contentHash }
}

export function skillFolderNameFromKey(key: string): string {
  return parseSkillGroupKey(key)?.name ?? key
}
