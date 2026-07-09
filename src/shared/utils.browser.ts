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
