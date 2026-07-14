import { useMemo, useRef, useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import type { ProjectInfo } from '@shared/types'

export const ALL_PROJECTS_KEY = '__all_projects__'

interface ProjectFilterDropdownProps {
  projects: ProjectInfo[]
  selectedProjectId: string
  onChange: (projectId: string) => void
}

export function ProjectFilterDropdown({
  projects,
  selectedProjectId,
  onChange
}: ProjectFilterDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const label = useMemo(() => {
    if (selectedProjectId === ALL_PROJECTS_KEY) return 'All projects'
    const project = projects.find((p) => p.id === selectedProjectId)
    return project?.name ?? 'All projects'
  }, [projects, selectedProjectId])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-300 min-w-[10rem]"
      >
        <span className="truncate max-w-[12rem]">{label}</span>
        <ChevronDown size={14} className="shrink-0 opacity-70" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 min-w-full max-h-64 overflow-y-auto bg-zinc-900 border border-zinc-700 rounded shadow-lg">
          <button
            type="button"
            onClick={() => {
              onChange(ALL_PROJECTS_KEY)
              setOpen(false)
            }}
            className={`block w-full text-left px-3 py-2 text-sm hover:bg-zinc-800 ${
              selectedProjectId === ALL_PROJECTS_KEY ? 'text-blue-400' : 'text-zinc-300'
            }`}
          >
            All projects
          </button>
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => {
                onChange(project.id)
                setOpen(false)
              }}
              className={`block w-full text-left px-3 py-2 text-sm hover:bg-zinc-800 truncate ${
                selectedProjectId === project.id ? 'text-blue-400' : 'text-zinc-300'
              }`}
              title={project.path}
            >
              {project.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
