/** Cursor hook lifecycle events in display order. */
export const CURSOR_HOOK_EVENTS = [
  'beforeSubmitPrompt',
  'afterAgentResponse',
  'afterAgentThought',
  'stop',
  'beforeShellExecution',
  'afterShellExecution',
  'beforeMCPExecution',
  'afterMCPExecution',
  'beforeReadFile',
  'afterFileEdit',
  'preToolUse',
  'postToolUse',
  'subagentStart',
  'subagentStop',
  'preCompact',
  'sessionStart',
  'sessionEnd'
] as const

export type CursorHookEvent = (typeof CURSOR_HOOK_EVENTS)[number]

export function hookEventSection(event: string): string {
  if ((CURSOR_HOOK_EVENTS as readonly string[]).includes(event)) return event
  return 'Other'
}

export function hookEventSortIndex(event: string): number {
  const idx = (CURSOR_HOOK_EVENTS as readonly string[]).indexOf(event)
  return idx === -1 ? CURSOR_HOOK_EVENTS.length : idx
}
