import { spawn } from 'child_process'
import type { McpResource, McpTool } from '@shared/types'
import { agentDebugLog } from './debug-log'

const PROBE_TIMEOUT_MS = 5000
const MAX_CONCURRENT = 3

interface ProbeResult {
  status: McpResource['status']
  tools: McpTool[]
}

function hasStdioTransport(params: Record<string, unknown>): boolean {
  return typeof params.command === 'string' && params.command.length > 0
}

function sendJsonRpc(
  proc: ReturnType<typeof spawn>,
  id: number,
  method: string,
  params: Record<string, unknown>
): void {
  const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params })
  proc.stdin?.write(`${payload}\n`)
}

async function probeStdioMcp(params: Record<string, unknown>): Promise<ProbeResult> {
  const command = String(params.command)
  const args = Array.isArray(params.args) ? params.args.map(String) : []
  const env = params.env && typeof params.env === 'object'
    ? { ...process.env, ...(params.env as Record<string, string>) }
    : process.env

  return new Promise((resolve) => {
    let settled = false
    let buffer = ''
    let initDone = false
    const tools: McpTool[] = []

    const finish = (result: ProbeResult) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      proc.kill()
      resolve(result)
    }

    const proc = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
      shell: process.platform === 'win32'
    })

    const timer = setTimeout(() => {
      finish({ status: 'disconnected', tools: [] })
    }, PROBE_TIMEOUT_MS)

    proc.on('error', () => finish({ status: 'error', tools: [] }))

    proc.stdout?.on('data', (chunk: Buffer) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const msg = JSON.parse(trimmed) as {
            id?: number
            result?: { tools?: Array<{ name?: string; description?: string }> }
            error?: unknown
          }
          if (msg.error) {
            finish({ status: 'error', tools: [] })
            return
          }
          if (msg.id === 1 && !initDone) {
            initDone = true
            sendJsonRpc(proc, 2, 'tools/list', {})
          }
          if (msg.id === 2) {
            for (const tool of msg.result?.tools ?? []) {
              if (tool.name) tools.push({ name: tool.name, description: tool.description })
            }
            finish({ status: 'connected', tools })
          }
        } catch {
          // ignore non-json lines
        }
      }
    })

    proc.stderr?.on('data', () => {
      // stderr output alone does not fail probe
    })

    sendJsonRpc(proc, 1, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'janus', version: '1.0.0' }
    })
  })
}

async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number
): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let index = 0

  async function worker(): Promise<void> {
    while (index < tasks.length) {
      const current = index++
      results[current] = await tasks[current]()
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()))
  return results
}

export async function probeMcpServers(
  servers: Array<{ name: string; params: Record<string, unknown> }>
): Promise<Map<string, ProbeResult>> {
  // #region agent log
  const probeStartedAt = Date.now()
  const stdioCount = servers.filter((s) => hasStdioTransport(s.params)).length
  agentDebugLog('A', 'mcp-probe.service.ts:probeMcpServers:start', 'MCP probe started', {
    serverCount: servers.length,
    stdioCount,
    maxConcurrent: MAX_CONCURRENT,
    timeoutMs: PROBE_TIMEOUT_MS
  })
  // #endregion

  const results = new Map<string, ProbeResult>()

  const tasks = servers.map((server) => async () => {
    if (!hasStdioTransport(server.params)) {
      return {
        name: server.name,
        result: { status: 'configured' as const, tools: [] as McpTool[] }
      }
    }
    const result = await probeStdioMcp(server.params)
    return { name: server.name, result }
  })

  const probed = await runWithConcurrency(tasks, MAX_CONCURRENT)
  for (const { name, result } of probed) {
    results.set(name, result)
  }

  // #region agent log
  agentDebugLog('A', 'mcp-probe.service.ts:probeMcpServers:end', 'MCP probe finished', {
    durationMs: Date.now() - probeStartedAt,
    serverCount: servers.length,
    stdioCount
  })
  // #endregion

  return results
}
