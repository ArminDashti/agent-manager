import { getValueAtPath, setValueAtPath } from '@renderer/lib/mcpParams'

interface McpFieldEditorProps {
  params: Record<string, unknown>
  selectedPath: string
  onChange: (params: Record<string, unknown>) => void
}

export function McpFieldEditor({ params, selectedPath, onChange }: McpFieldEditorProps) {
  const value = getValueAtPath(params, selectedPath)
  const valueType = Array.isArray(value)
    ? 'array'
    : value === null
      ? 'null'
      : typeof value

  const updateValue = (next: unknown) => {
    onChange(setValueAtPath(params, selectedPath, next))
  }

  if (valueType === 'object') {
    return (
      <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-400">
        <code className="text-blue-400">{selectedPath}</code> is an object with{' '}
        {Object.keys(value as Record<string, unknown>).length} keys. Select a child field in the picker
        above to edit its values.
      </div>
    )
  }

  if (valueType === 'array') {
    const arr = value as unknown[]
    return (
      <div className="space-y-2">
        <p className="text-xs text-zinc-500">Array · {arr.length} items</p>
        {arr.map((item, index) => (
          <div key={index} className="flex gap-2 items-center">
            <span className="text-xs text-zinc-500 w-8 shrink-0">[{index}]</span>
            <input
              value={typeof item === 'string' ? item : JSON.stringify(item)}
              onChange={(e) => {
                const next = [...arr]
                next[index] = e.target.value
                updateValue(next)
              }}
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm font-mono"
            />
            <button
              type="button"
              onClick={() => updateValue(arr.filter((_, i) => i !== index))}
              className="px-2 py-1 text-xs text-red-400 hover:bg-zinc-800 rounded"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => updateValue([...arr, ''])}
          className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 rounded"
        >
          Add item
        </button>
      </div>
    )
  }

  if (valueType === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value as boolean}
          onChange={(e) => updateValue(e.target.checked)}
        />
        {selectedPath}
      </label>
    )
  }

  if (valueType === 'number') {
    return (
      <input
        type="number"
        value={value as number}
        onChange={(e) => updateValue(Number(e.target.value))}
        className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm font-mono"
      />
    )
  }

  if (valueType === 'undefined') {
    return (
      <div className="space-y-2">
        <p className="text-sm text-zinc-500">Field not set</p>
        <button
          type="button"
          onClick={() => updateValue('')}
          className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 rounded"
        >
          Initialize as empty string
        </button>
      </div>
    )
  }

  return (
    <textarea
      value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
      onChange={(e) => updateValue(e.target.value)}
      rows={valueType === 'string' && (value as string).length > 80 ? 4 : 2}
      className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm font-mono resize-y"
    />
  )
}
