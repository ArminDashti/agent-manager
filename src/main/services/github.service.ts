import { net } from 'electron'

export interface PatValidationResult {
  valid: boolean
  login?: string
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

export function withPatInGitUrl(url: string, pat: string): string {
  if (!pat.trim()) return url
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== 'github.com') return url
    parsed.username = pat.trim()
    parsed.password = ''
    return parsed.toString()
  } catch {
    return url
  }
}

export async function validatePat(pat: string): Promise<PatValidationResult> {
  const token = pat.trim()
  if (!token) return { valid: false }

  return new Promise((resolve) => {
    const request = net.request({
      method: 'GET',
      url: 'https://api.github.com/user',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Janus-Agent-Manager'
      }
    })

    let body = ''
    request.on('response', (response) => {
      response.on('data', (chunk) => {
        body += chunk.toString()
      })
      response.on('end', () => {
        if (response.statusCode === 200) {
          try {
            const parsed = JSON.parse(body) as { login?: string }
            resolve({ valid: true, login: parsed.login })
          } catch {
            resolve({ valid: true })
          }
        } else {
          resolve({ valid: false })
        }
      })
    })

    request.on('error', () => resolve({ valid: false }))
    request.end()
  })
}
