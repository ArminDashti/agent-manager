export function ruleBaseName(filename: string): string {
  return filename.replace(/\.(mdc|md)$/i, '')
}

export function ruleDisplayName(filename: string): string {
  return `${ruleBaseName(filename)}.md`
}

export function ruleFileNameForPlatform(baseName: string, platformId: string): string {
  const ext = platformId === 'cursor' ? '.mdc' : '.md'
  return `${baseName}${ext}`
}

export function rulesMatchName(a: string, b: string): boolean {
  return ruleBaseName(a) === ruleBaseName(b)
}

export function ruleMatchesDisplayName(fileName: string, displayName: string): boolean {
  return rulesMatchName(fileName, displayName)
}
