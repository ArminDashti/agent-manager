import { useCallback, useEffect, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@renderer/lib/utils'

type EditorMode = 'edit' | 'preview'

interface MarkdownEditorProps {
  filePath?: string
  value: string
  onChange?: (value: string) => void
  onSave?: (value: string) => Promise<void>
  readOnly?: boolean
  className?: string
}

export function MarkdownEditor({
  filePath,
  value,
  onChange,
  onSave,
  readOnly = false,
  className
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<EditorMode>('edit')
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const [savedContent, setSavedContent] = useState(value)

  useEffect(() => {
    setDraft(value)
    setSavedContent(value)
  }, [value, filePath])

  const handleSave = useCallback(async () => {
    if (!onSave) return
    setSaving(true)
    try {
      await onSave(draft)
      setSavedContent(draft)
      onChange?.(draft)
    } finally {
      setSaving(false)
    }
  }, [draft, onSave, onChange])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        void handleSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave])

  return (
    <div className={cn('flex flex-col h-full border border-zinc-800 rounded-lg overflow-hidden', className)}>
      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex rounded-md overflow-hidden border border-zinc-700">
          <button
            type="button"
            onClick={() => setMode('edit')}
            className={cn(
              'px-3 py-1 text-xs',
              mode === 'edit' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
            )}
          >
            Edit (.md)
          </button>
          <button
            type="button"
            onClick={() => setMode('preview')}
            className={cn(
              'px-3 py-1 text-xs',
              mode === 'preview' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
            )}
          >
            Preview (.md)
          </button>
        </div>
        {filePath && <span className="text-xs text-zinc-500 truncate flex-1">{filePath}</span>}
        {!readOnly && onSave && (
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="px-3 py-1 text-xs bg-emerald-700 hover:bg-emerald-600 rounded disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {mode === 'edit' ? (
          <CodeMirror
            value={draft}
            height="100%"
            theme={oneDark}
            extensions={[markdown()]}
            editable={!readOnly}
            onChange={(v) => {
              setDraft(v)
              onChange?.(v)
            }}
            className="h-full"
          />
        ) : (
          <div className="markdown-preview h-full overflow-auto max-w-full min-w-0">
            <div className="max-w-full min-w-0 break-words">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{savedContent}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
