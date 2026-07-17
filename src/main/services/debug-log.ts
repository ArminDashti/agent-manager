import { appendFileSync } from 'fs'
import { join } from 'path'

const LOG_PATH = join(
  'C:',
  'Users',
  'armin',
  'Documents',
  'GitHub',
  'agent-manager',
  'debug-c00194.log'
)

/** Session debug NDJSON logger — remove after bug investigation. */
export function agentDebugLog(
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown> = {}
): void {
  // #region agent log
  try {
    appendFileSync(
      LOG_PATH,
      `${JSON.stringify({
        sessionId: 'c00194',
        hypothesisId,
        location,
        message,
        data,
        timestamp: Date.now()
      })}\n`
    )
  } catch {
    // ignore debug log failures
  }
  // #endregion
}
