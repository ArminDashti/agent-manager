import { useMemo, useState } from 'react'
import { ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

interface TreeNode {
  label: string
  path: string
  children: TreeNode[]
  count: number
}

// Each TreeNode keeps a mutable childMap for building; we strip it before render.
interface BuildNode extends TreeNode {
  childMap: Record<string, BuildNode>
}

function buildTree(names: string[]): TreeNode[] {
  const rootMap: Record<string, BuildNode> = {}

  for (const name of names) {
    const parts = name.split('/')
    if (parts.length < 2) continue
    const dirs = parts.slice(0, -1)
    let currentMap = rootMap
    let pathAccum = ''
    for (const part of dirs) {
      pathAccum = pathAccum ? `${pathAccum}/${part}` : part
      if (!currentMap[part]) {
        currentMap[part] = { label: part, path: pathAccum, children: [], count: 0, childMap: {} }
      }
      currentMap[part].count++
      currentMap = currentMap[part].childMap
    }
  }

  function toNodes(map: Record<string, BuildNode>): TreeNode[] {
    return Object.values(map)
      .sort((a, b) => a.label.localeCompare(b.label))
      .map(({ childMap, ...rest }) => ({ ...rest, children: toNodes(childMap) }))
  }

  return toNodes(rootMap)
}

interface TreeNodeItemProps {
  node: TreeNode
  selectedPath: string | null
  onSelect: (path: string | null) => void
  depth: number
}

function TreeNodeItem({ node, selectedPath, onSelect, depth }: TreeNodeItemProps) {
  const [open, setOpen] = useState(true)
  const hasChildren = node.children.length > 0
  const isSelected = selectedPath === node.path

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (isSelected) {
            onSelect(null)
          } else {
            onSelect(node.path)
          }
          if (hasChildren) setOpen((o) => !o)
        }}
        className={cn(
          'w-full flex items-center gap-1 text-left text-xs py-1 rounded transition-colors',
          isSelected
            ? 'bg-blue-600/20 text-blue-400'
            : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
        )}
        style={{ paddingLeft: `${8 + depth * 12}px`, paddingRight: 8 }}
      >
        {hasChildren ? (
          open ? (
            <ChevronDown size={12} className="shrink-0" />
          ) : (
            <ChevronRight size={12} className="shrink-0" />
          )
        ) : (
          <span className="w-3 shrink-0" />
        )}
        {open ? (
          <FolderOpen size={12} className="shrink-0" />
        ) : (
          <Folder size={12} className="shrink-0" />
        )}
        <span className="truncate flex-1">{node.label}</span>
        <span className="text-zinc-600 shrink-0">{node.count}</span>
      </button>
      {hasChildren && open && (
        <div>
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.path}
              node={child}
              selectedPath={selectedPath}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface ResourceDirTreeProps {
  names: string[]
  selectedPath: string | null
  onSelect: (path: string | null) => void
}

export function ResourceDirTree({ names, selectedPath, onSelect }: ResourceDirTreeProps) {
  const tree = useMemo(() => buildTree(names), [names])

  if (tree.length === 0) return null

  return (
    <div className="w-48 shrink-0 border-r border-zinc-800 overflow-auto py-1">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          'w-full flex items-center gap-1 text-left text-xs py-1 px-2 rounded transition-colors mb-0.5',
          selectedPath === null
            ? 'bg-blue-600/20 text-blue-400'
            : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200'
        )}
      >
        <FolderOpen size={12} className="shrink-0" />
        <span>All</span>
      </button>
      {tree.map((node) => (
        <TreeNodeItem
          key={node.path}
          node={node}
          selectedPath={selectedPath}
          onSelect={onSelect}
          depth={0}
        />
      ))}
    </div>
  )
}
