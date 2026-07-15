const INVALID_NAME_CHARS = /[/\\:*?"<>|]/

export function isValidResourceName(name: string): boolean {
  const trimmed = name.trim()
  return trimmed.length > 0 && !INVALID_NAME_CHARS.test(trimmed)
}
