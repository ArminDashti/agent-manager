import type { ReactNode } from 'react'
import { useDefaultLayout } from 'react-resizable-panels'
import { Group, Panel, ResizeHandle } from './ResizablePanels'

interface ThreePanelLayoutProps {
  left: ReactNode
  middle: ReactNode
  right: ReactNode
  autoSaveId?: string
  defaultLeftSize?: number
  defaultMiddleSize?: number
  minLeftSize?: number
  maxLeftSize?: number
  minMiddleSize?: number
  maxMiddleSize?: number
}

export function ThreePanelLayout({
  left,
  middle,
  right,
  autoSaveId,
  defaultLeftSize = 20,
  defaultMiddleSize = 20,
  minLeftSize = 15,
  maxLeftSize = 35,
  minMiddleSize = 15,
  maxMiddleSize = 35
}: ThreePanelLayoutProps) {
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: autoSaveId ?? 'three-panel-default',
    panelIds: ['left', 'middle', 'right'],
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
        <div className="h-full min-w-0 overflow-hidden border-r border-zinc-800">{left}</div>
      </Panel>
      <ResizeHandle />
      <Panel id="middle" defaultSize={defaultMiddleSize} minSize={minMiddleSize} maxSize={maxMiddleSize}>
        <div className="h-full min-w-0 overflow-hidden border-r border-zinc-800">{middle}</div>
      </Panel>
      <ResizeHandle />
      <Panel id="right" minSize={30}>
        <div className="h-full min-w-0 overflow-hidden">{right}</div>
      </Panel>
    </Group>
  )
}
