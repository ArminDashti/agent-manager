export function isMarkdownFile(path: string): boolean {
  return /\.(md|mdc)$/i.test(path)
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
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    let value: unknown = line.slice(idx + 1).trim()
    if (typeof value === 'string' && value.startsWith('|')) {
      value = value.slice(1).trim()
    }
    if (value === 'true') value = true
    if (value === 'false') value = false
    frontmatter[key] = value
  }

  return { frontmatter, body: match[2] }
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
