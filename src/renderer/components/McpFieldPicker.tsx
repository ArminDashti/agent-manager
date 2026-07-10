import { flattenParamPaths, formatPathLabel, type FlatParamPath } from '@renderer/lib/mcpParams'

interface McpFieldPickerProps {
  params: Record<string, unknown>
  selectedPath: string
  onSelect: (path: string) => void
}

export function McpFieldPicker({ params, selectedPath, onSelect }: McpFieldPickerProps) {
  const paths = flattenParamPaths(params)

  if (paths.length === 0) {
    return (
      <select className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm" disabled>
        <option>No fields</option>
      </select>
    )
  }

  return (
    <select
      value={selectedPath}
      onChange={(e) => onSelect(e.target.value)}
      className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm font-mono"
    >
      {paths.map((entry: FlatParamPath) => (
        <option key={entry.path} value={entry.path}>
          {formatPathLabel(entry)} ({entry.valueType})
        </option>
      ))}
    </select>
  )
}
