import { cn } from '@renderer/lib/utils'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  title?: string
  disabled?: boolean
}

export function Toggle({ checked, onChange, title, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      title={title}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors',
        checked ? 'bg-blue-600' : 'bg-zinc-700',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 rounded-full bg-white transform transition-transform mt-0.5',
          checked ? 'translate-x-4' : 'translate-x-0.5'
        )}
      />
    </button>
  )
}
