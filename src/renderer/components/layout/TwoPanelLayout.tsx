import type { ReactNode } from 'react'
import { useDefaultLayout } from 'react-resizable-panels'
import { Group, Panel, ResizeHandle } from './ResizablePanels'

interface TwoPanelLayoutProps {
  left: ReactNode
  right: ReactNode
  autoSaveId?: string
  defaultLeftSize?: number
  minLeftSize?: number
  maxLeftSize?: number
}

export function TwoPanelLayout({
  left,
  right,
  autoSaveId,
  defaultLeftSize = 25,
  minLeftSize = 15,
  maxLeftSize = 40
}: TwoPanelLayoutProps) {
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: autoSaveId ?? 'two-panel-default',
    panelIds: ['left', 'right'],
    storage: localStorage
  })

  return (
    <Group
      orientation="horizontal"
      defaultLayout={defaultLayout}
      onLayoutChanged={onLayoutChanged}
      className="flex-1 min-h-0"
    >
      <Panel id="left" defaultSize={defaultLeftSize} minSize={minLeftSize} maxSize={maxLeftSize}>
        <div className="h-full overflow-auto border-r border-zinc-800">{left}</div>
      </Panel>
      <ResizeHandle />
      <Panel id="right" minSize={30}>
        <div className="h-full min-w-0 overflow-hidden">{right}</div>
      </Panel>
    </Group>
  )
}
