import { cn } from '@renderer/lib/utils'
import type { ProjectUsageFilter } from '@shared/types'

const OPTIONS: { value: ProjectUsageFilter; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'multiple', label: 'Multiple' },
  { value: 'both', label: 'Both' }
]

interface ProjectUsageFilterProps {
  value: ProjectUsageFilter
  onChange: (value: ProjectUsageFilter) => void
}

export function ProjectUsageFilterGroup({ value, onChange }: ProjectUsageFilterProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 p-0.5">
      {OPTIONS.map((option) => {
        const active = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap',
              active
                ? 'bg-blue-600 text-white'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            )}
            title={
              option.value === 'single'
                ? 'Only resources used in one project'
                : option.value === 'multiple'
                  ? 'Only resources used in multiple projects'
                  : 'All resources'
            }
          >
            <span
              className={cn(
                'inline-block h-2 w-2 rounded-full',
                active ? 'bg-white' : 'bg-zinc-600'
              )}
            />
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
