import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { oneDark } from '@codemirror/theme-one-dark'
import { cn } from '@renderer/lib/utils'

interface JsonEditorProps {
  value: string
  onChange?: (value: string) => void
  onSave?: (value: string) => Promise<void>
  readOnly?: boolean
  className?: string
}

export function JsonEditor({ value, onChange, onSave, readOnly, className }: JsonEditorProps) {
  return (
    <div className={cn('flex flex-col h-full border border-zinc-800 rounded-lg overflow-hidden', className)}>
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900 border-b border-zinc-800">
        <span className="text-xs text-zinc-500">JSON</span>
        {!readOnly && onSave && (
          <button
            type="button"
            onClick={() => void onSave(value)}
            className="px-3 py-1 text-xs bg-emerald-700 hover:bg-emerald-600 rounded"
          >
            Save
          </button>
        )}
      </div>
      <CodeMirror
        value={value}
        height="100%"
        theme={oneDark}
        extensions={[json()]}
        editable={!readOnly}
        onChange={onChange}
        className="flex-1"
      />
    </div>
  )
}
