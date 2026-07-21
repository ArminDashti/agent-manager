import { useMemo } from 'react'
import { Folder } from 'lucide-react'
import type { AppSettings, PlatformConfig } from '@shared/types'
import { DEFAULT_PLATFORM_ROOTS, PLATFORM_LABELS } from '@shared/types'
import { PlatformLogo } from '@renderer/components/PlatformLogo'
import { cn } from '@renderer/lib/utils'

interface PlatformsTabProps {
  settings: AppSettings
  onChange: (settings: AppSettings) => void
}

function getCursorPlatform(settings: AppSettings): PlatformConfig {
  const existing = settings.platforms.find((p) => p.id === 'cursor')
  return (
    existing ?? {
      id: 'cursor',
      enabled: true,
      rootPath: DEFAULT_PLATFORM_ROOTS.cursor
    }
  )
}

export function PlatformsTab({ settings }: PlatformsTabProps) {
  const cursor = useMemo(() => getCursorPlatform(settings), [settings])

  return (
    <div className="space-y-6 pb-6">
      <p className="text-xs text-zinc-500">
        Janus manages Cursor only. This platform is locked and cannot be changed here.
      </p>

      <div
        className={cn(
          'flex flex-col gap-3 p-4 rounded-xl border max-w-xl',
          'bg-zinc-900/70 border-zinc-700'
        )}
      >
        <div className="flex items-center gap-3">
          <PlatformLogo platformId="cursor" size={36} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-100">
                {PLATFORM_LABELS.cursor}
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Enabled" />
              <span className="text-[10px] uppercase tracking-wide text-zinc-500 border border-zinc-700 rounded px-1.5 py-0.5">
                Locked
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">Always enabled</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Folder size={14} strokeWidth={1.75} className="text-zinc-500 shrink-0" />
          <input
            value={cursor.rootPath}
            readOnly
            title={cursor.rootPath}
            className="flex-1 min-w-0 bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs font-mono text-zinc-400 cursor-default"
          />
        </div>
      </div>
    </div>
  )
}
