import { net } from 'electron'
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

function buildPrompt(resourceType: OpenRouterRefactorType, content: string, userPrompt: string): string {
  const label = TYPE_LABELS[resourceType]
  return [
    `You must edit the ${label}:`,
    content,
    '',
    `User prompts for editing the ${label}:`,
    userPrompt,
    '',
    'Return only the full edited content. Do not wrap it in markdown code fences. Do not add commentary.'
  ].join('\n')
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim()
  const match = trimmed.match(/^```(?:[\w+-]*)?\r?\n([\s\S]*?)\r?\n```$/)
  return match ? match[1].trimEnd() : trimmed
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

  const content = parsed.choices?.[0]?.message?.content
  if (!content?.trim()) {
    throw new Error('OpenRouter returned an empty response')
  }

  return {
    content: stripCodeFences(content),
    model
  }
}
