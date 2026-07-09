import { cn } from '@renderer/lib/utils'
import { File, Folder } from 'lucide-react'

interface FileTreeProps {
  files: string[]
  selected?: string
  onSelect: (path: string) => void
  rootPath?: string
}

export function FileTree({ files, selected, onSelect, rootPath }: FileTreeProps) {
  const display = files
    .map((f) => (rootPath ? f.replace(rootPath, '').replace(/^[/\\]/, '') : f))
    .sort()

  return (
    <ul className="text-sm space-y-0.5 p-2 overflow-auto h-full">
      {display.map((rel, i) => {
        const full = files[i]
        const isDir = false
        return (
          <li key={full}>
            <button
              type="button"
              onClick={() => onSelect(full)}
              className={cn(
                'w-full text-left flex items-center gap-2 px-2 py-1 rounded hover:bg-zinc-800',
                selected === full && 'bg-zinc-800 text-blue-400'
              )}
            >
              {isDir ? <Folder size={14} /> : <File size={14} />}
              <span className="truncate">{rel}</span>
            </button>
          </li>
        )
      })}
      {files.length === 0 && (
        <li className="text-zinc-500 text-xs p-2">No files</li>
      )}
    </ul>
  )
}
