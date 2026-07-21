import { useMemo, useRef, useState, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
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
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; minWidth: number } | null>(
    null
  )
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const updatePosition = () => {
    const el = rootRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setMenuPos({
      top: rect.bottom + 4,
      left: rect.left,
      minWidth: Math.max(rect.width, 160)
    })
  }

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null)
      return
    }
    updatePosition()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onScrollOrResize = () => updatePosition()
    window.addEventListener('resize', onScrollOrResize)
    window.addEventListener('scroll', onScrollOrResize, true)
    return () => {
      window.removeEventListener('resize', onScrollOrResize)
      window.removeEventListener('scroll', onScrollOrResize, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (rootRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const label = useMemo(() => {
    if (selectedProjectId === ALL_PROJECTS_KEY) return 'All projects'
    const project = projects.find((p) => p.id === selectedProjectId)
    return project?.name ?? 'All projects'
  }, [projects, selectedProjectId])

  const menu =
    open && menuPos
      ? createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: menuPos.top,
              left: menuPos.left,
              minWidth: menuPos.minWidth,
              zIndex: 9999
            }}
            className="max-h-64 overflow-y-auto bg-zinc-900 border border-zinc-700 rounded shadow-lg"
          >
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
          </div>,
          document.body
        )
      : null

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-300 min-w-[10rem]"
      >
        <span className="truncate max-w-[12rem]">{label}</span>
        <ChevronDown size={14} className="shrink-0 opacity-70" />
      </button>
      {menu}
    </div>
  )
}
