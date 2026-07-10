import { Group, Panel, Separator } from 'react-resizable-panels'
import { cn } from '@renderer/lib/utils'

interface ResizeHandleProps {
  className?: string
}

export function ResizeHandle({ className }: ResizeHandleProps) {
  return (
    <Separator
      className={cn(
        'w-px bg-zinc-800 hover:bg-blue-500/50 active:bg-blue-500 transition-colors relative',
        'data-[separator]:after:absolute data-[separator]:after:inset-y-0 data-[separator]:after:-left-1 data-[separator]:after:-right-1',
        className
      )}
    />
  )
}

export { Group, Panel }
