import { useEffect, useState } from 'react'
import { Minus, Square, Copy, X, Sparkles } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

export function TitleBar() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    void window.agentManager.isWindowMaximized().then(setMaximized)
  }, [])

  const handleMaximize = async () => {
    const next = await window.agentManager.maximizeWindow()
    setMaximized(next)
  }

  return (
    <header className="titlebar-drag flex items-center h-9 shrink-0 bg-zinc-900/95 backdrop-blur border-b border-zinc-800 select-none">
      <div className="flex items-center gap-2 px-3 titlebar-no-drag">
        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-blue-600/20 text-blue-400">
          <Sparkles size={14} />
        </div>
        <span className="text-sm font-medium text-zinc-200">Janus</span>
        <span className="text-xs text-zinc-500 hidden sm:inline">Skills · Rules · MCPs</span>
      </div>

      <div className="flex-1 h-full" />

      <div className="flex items-center titlebar-no-drag">
        <button
          type="button"
          onClick={() => void window.agentManager.minimizeWindow()}
          className="flex items-center justify-center w-11 h-9 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
          aria-label="Minimize"
        >
          <Minus size={14} />
        </button>
        <button
          type="button"
          onClick={() => void handleMaximize()}
          className="flex items-center justify-center w-11 h-9 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
          aria-label={maximized ? 'Restore' : 'Maximize'}
        >
          {maximized ? <Copy size={12} /> : <Square size={12} />}
        </button>
        <button
          type="button"
          onClick={() => void window.agentManager.closeWindow()}
          className={cn(
            'flex items-center justify-center w-11 h-9 text-zinc-400 transition-colors',
            'hover:bg-red-600 hover:text-white'
          )}
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>
    </header>
  )
}
