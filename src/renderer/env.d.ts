/// <reference types="vite/client" />

import type { AgentManagerApi } from '../preload/index'

declare global {
  interface Window {
    agentManager: AgentManagerApi
  }
}

export {}
