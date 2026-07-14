import { app } from 'electron'

export function applyStartupSetting(enabled: boolean): void {
  if (process.platform !== 'win32' && process.platform !== 'darwin') return

  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath,
    args: []
  })
}
