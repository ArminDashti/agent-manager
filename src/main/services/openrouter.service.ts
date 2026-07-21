import { net } from 'electron'
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { getAppRoot } from '../app-paths'
import { settingsStore } from './settings-store'

export type OpenRouterRefactorType = 'skill' | 'rule' | 'hook' | 'subAgent'

const TYPE_LABELS: Record<OpenRouterRefactorType, string> = {
  skill: 'Skills',
  rule: 'Rules',
  hook: 'Hooks',
  subAgent: 'Sub-agent'
}

export interface OpenRouterRefactorRequest {
  resourceType: OpenRouterRefactorType
  content: string
  userPrompt: string
}

export interface OpenRouterRefactorResult {
  content: string
  model: string
}

function loadInstructionTemplate(): string {
  try {
    const path = join(getAppRoot(), 'instructions', 'openrouter.md')
    if (existsSync(path)) return readFileSync(path, 'utf-8')
  } catch {
    // fall through to default
  }
  return [
    '# OpenRouter Instruction',
    '',
    'Edit ONLY the lines that need to change based on the user request.',
    'Return a unified diff in the following format:',
    '',
    '```',
    '--- a',
    '+++ b',
    '@@ -LINE,COUNT +LINE,COUNT @@',
    ' context line',
    '-removed line',
    '+added line',
    ' context line',
    '```',
    '',
    'Rules:',
    '- Return ONLY the unified diff block. No prose, no explanation.',
    '- Use 3 lines of context before and after each change.',
    '- Do not rewrite unchanged sections.',
    '- Preserve indentation and formatting exactly.',
    '- If the entire file needs replacing, output a full replacement diff.',
  ].join('\n')
}

function buildPrompt(resourceType: OpenRouterRefactorType, content: string, userPrompt: string): string {
  const label = TYPE_LABELS[resourceType]
  const instruction = loadInstructionTemplate()
  return [
    instruction,
    '',
    `## ${label} content to edit:`,
    '```',
    content,
    '```',
    '',
    `## User request:`,
    userPrompt,
  ].join('\n')
}

/**
 * Apply a unified diff to original content.
 * Returns the patched string, or the original if the diff cannot be applied cleanly.
 */
function applyUnifiedDiff(original: string, diffText: string): string {
  const lines = original.split('\n')
  const diffLines = diffText.split('\n')

  let result = [...lines]
  let offset = 0

  const hunkHeaderRe = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/

  let i = 0
  while (i < diffLines.length) {
    const line = diffLines[i]
    const m = hunkHeaderRe.exec(line)
    if (!m) { i++; continue }

    const origStart = parseInt(m[1], 10) - 1
    i++

    const hunkOrig: string[] = []
    const hunkNew: string[] = []

    while (i < diffLines.length && !hunkHeaderRe.test(diffLines[i])) {
      const dl = diffLines[i]
      if (dl.startsWith('-')) {
        hunkOrig.push(dl.slice(1))
      } else if (dl.startsWith('+')) {
        hunkNew.push(dl.slice(1))
      } else {
        const ctx = dl.startsWith(' ') ? dl.slice(1) : dl
        hunkOrig.push(ctx)
        hunkNew.push(ctx)
      }
      i++
    }

    const pos = origStart + offset
    result.splice(pos, hunkOrig.length, ...hunkNew)
    offset += hunkNew.length - hunkOrig.length
  }

  return result.join('\n')
}

function extractDiffBlock(text: string): string {
  const fenceMatch = text.match(/```(?:diff|patch)?\n([\s\S]*?)```/)
  if (fenceMatch) return fenceMatch[1].trimEnd()
  const hunks = text.split('\n').filter(
    (l) => l.startsWith('---') || l.startsWith('+++') || l.startsWith('@@') ||
           l.startsWith('+') || l.startsWith('-') || l.startsWith(' ')
  )
  return hunks.length > 3 ? hunks.join('\n') : text.trim()
}

function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<{
  statusCode: number
  body: string
}> {
  return new Promise((resolve, reject) => {
    const request = net.request({ method: 'POST', url, headers })
    let responseBody = ''

    request.on('response', (response) => {
      response.on('data', (chunk) => {
        responseBody += chunk.toString()
      })
      response.on('end', () => {
        resolve({ statusCode: response.statusCode ?? 0, body: responseBody })
      })
    })

    request.on('error', (err) => reject(err))
    request.write(JSON.stringify(body))
    request.end()
  })
}

export async function refactorWithOpenRouter(
  request: OpenRouterRefactorRequest
): Promise<OpenRouterRefactorResult> {
  const settings = settingsStore.get()
  const apiKey = settings.openRouter?.apiKey?.trim() ?? ''
  const model = settings.openRouter?.model?.trim() || 'openai/gpt-4o-mini'

  if (!apiKey) {
    throw new Error('OpenRouter API key is not configured. Set it in Settings → OpenRouter.')
  }
  if (!request.userPrompt.trim()) {
    throw new Error('A user prompt is required')
  }
  if (!request.content.trim()) {
    throw new Error('Resource content is empty')
  }

  const prompt = buildPrompt(request.resourceType, request.content, request.userPrompt.trim())

  const { statusCode, body } = await postJson(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/armindashti/agent-manager',
      'X-Title': 'Janus Agent Manager'
    },
    {
      model,
      messages: [{ role: 'user', content: prompt }]
    }
  )

  if (statusCode < 200 || statusCode >= 300) {
    let message = `OpenRouter request failed (${statusCode})`
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string } }
      if (parsed.error?.message) message = parsed.error.message
    } catch {
      if (body.trim()) message = body.trim().slice(0, 300)
    }
    throw new Error(message)
  }

  let parsed: {
    choices?: Array<{ message?: { content?: string } }>
  }
  try {
    parsed = JSON.parse(body) as typeof parsed
  } catch {
    throw new Error('OpenRouter returned invalid JSON')
  }

  const rawContent = parsed.choices?.[0]?.message?.content
  if (!rawContent?.trim()) {
    throw new Error('OpenRouter returned an empty response')
  }

  const diffBlock = extractDiffBlock(rawContent)
  const hasDiffMarkers = diffBlock.includes('@@') && (diffBlock.includes('---') || diffBlock.includes('+++'))
  const patchedContent = hasDiffMarkers
    ? applyUnifiedDiff(request.content, diffBlock)
    : rawContent.trim()

  return {
    content: patchedContent,
    model
  }
}
