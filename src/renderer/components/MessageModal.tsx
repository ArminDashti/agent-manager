import { cn } from '@renderer/lib/utils'
import { useMessageStore } from '@renderer/stores/messageStore'

export function MessageModal() {
  const { open, message, type, confirm, title, close } = useMessageStore()

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-5 w-[360px]">
        {title && <h3 className="text-sm font-medium text-zinc-200 mb-2">{title}</h3>}
        <p
          className={cn(
            'text-sm',
            type === 'error' && 'text-red-400',
            type === 'success' && 'text-emerald-400',
            type === 'info' && 'text-zinc-200'
          )}
        >
          {message}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          {confirm && (
            <button
              type="button"
              onClick={() => close(false)}
              className="px-4 py-1.5 text-sm bg-zinc-800 rounded hover:bg-zinc-700"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={() => close(true)}
            className={cn(
              'px-4 py-1.5 text-sm rounded',
              type === 'error' ? 'bg-red-700 hover:bg-red-600' : 'bg-zinc-800 hover:bg-zinc-700'
            )}
          >
            {confirm ? 'Confirm' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  )
}
