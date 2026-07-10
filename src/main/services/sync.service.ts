import { settingsStore } from './settings-store'
import { repoBankService } from './repo-bank.service'

let syncTimer: ReturnType<typeof setInterval> | null = null

export async function runSyncCycle(): Promise<void> {
  const settings = settingsStore.get()
  if (!settings.repoBank.url) return

  try {
    await repoBankService.fetch()
    await repoBankService.commitAndPush('Janus auto-sync')
    settingsStore.update((s) => ({
      ...s,
      sync: { ...(s.sync ?? { enabled: true, intervalMinutes: 30, lastSyncAt: null }), lastSyncAt: new Date().toISOString() }
    }))
  } catch {
    // silent background sync failures
  }
}

export function startSyncTimer(): void {
  stopSyncTimer()
  const settings = settingsStore.get()
  const sync = settings.sync ?? { enabled: true, intervalMinutes: 30, lastSyncAt: null }
  if (!sync.enabled || !settings.repoBank.url) return

  const minutes = sync.intervalMinutes ?? 30
  const ms = Math.max(1, minutes) * 60 * 1000
  syncTimer = setInterval(() => void runSyncCycle(), ms)
}

export function stopSyncTimer(): void {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
  }
}

export function restartSyncTimer(): void {
  stopSyncTimer()
  startSyncTimer()
}
