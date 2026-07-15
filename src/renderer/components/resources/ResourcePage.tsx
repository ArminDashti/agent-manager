import { useCallback, useEffect, useRef, useState } from 'react'
import type { ResourceType, UiFilterState } from '@shared/types'
import { ResourceListView } from './ResourceListView'
import { HooksListView } from './HooksListView'
import { ResourceAssignView } from './ResourceAssignView'
import { ResourceEditView } from './ResourceEditView'
import { AddResourceModal, isCreatableResourceType } from './AddResourceModal'
import { useAppStore } from '@renderer/stores/appStore'
import { showMessage } from '@renderer/stores/messageStore'
import {
  filterStorageKey,
  mergeUiFilter,
  type ListableResourceType
} from '@renderer/lib/filter-utils'

type ViewMode = 'list' | 'assign' | 'edit'

interface ResourcePageProps {
  title: string
  subtitle?: string
  resourceType: ListableResourceType
  showAdd?: boolean
}

export function ResourcePage({ title, subtitle, resourceType, showAdd = false }: ResourcePageProps) {
  const { refreshScan, settings } = useAppStore()
  const [view, setView] = useState<ViewMode>('list')
  const [activeName, setActiveName] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [summaries, setSummaries] = useState<Awaited<ReturnType<typeof window.agentManager.getResourceStats>>>([])
  const [loading, setLoading] = useState(true)

  const storageKey = filterStorageKey(resourceType)
  const [filterState, setFilterState] = useState<UiFilterState>(() =>
    mergeUiFilter(settings?.uiFilters?.[storageKey])
  )

  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (settings?.uiFilters?.[storageKey]) {
      setFilterState(mergeUiFilter(settings.uiFilters[storageKey]))
    }
  }, [settings, storageKey])

  const persistFilters = useCallback(
    (next: UiFilterState) => {
      if (!settings) return
      if (persistTimer.current) clearTimeout(persistTimer.current)
      persistTimer.current = setTimeout(() => {
        void window.agentManager.saveSettings({
          ...settings,
          uiFilters: {
            ...settings.uiFilters,
            [storageKey]: next
          }
        })
      }, 300)
    },
    [settings, storageKey]
  )

  const handleFilterChange = useCallback(
    (patch: Partial<UiFilterState>) => {
      setFilterState((prev) => {
        const next = { ...prev, ...patch }
        persistFilters(next)
        return next
      })
    },
    [persistFilters]
  )

  const loadSummaries = useCallback(async () => {
    setLoading(true)
    try {
      const stats = await window.agentManager.getResourceStats(resourceType)
      setSummaries(stats)
    } finally {
      setLoading(false)
    }
  }, [resourceType])

  useEffect(() => {
    void loadSummaries()
  }, [loadSummaries])

  useEffect(() => {
    const handler = () => void loadSummaries()
    window.addEventListener('scan-changed', handler)
    return () => window.removeEventListener('scan-changed', handler)
  }, [loadSummaries])

  const handleRename = async (oldName: string, newName: string) => {
    if (resourceType === 'tool') return
    try {
      await window.agentManager.renameResource(resourceType, oldName, newName)
      await loadSummaries()
      await refreshScan()
    } catch (e) {
      await showMessage({
        message: e instanceof Error ? e.message : 'Rename failed',
        type: 'error'
      })
    }
  }

  const handleDelete = async (name: string) => {
    const confirmed = await showMessage({
      message: `Delete "${name}" from all locations? This cannot be undone.`,
      confirm: true,
      type: 'error',
      title: 'Delete resource'
    })
    if (!confirmed) return
    await window.agentManager.deleteResource(resourceType, name)
    await loadSummaries()
    await refreshScan()
  }

  if (view === 'assign' && activeName) {
    return (
      <ResourceAssignView
        resourceType={resourceType}
        resourceName={activeName}
        onBack={() => {
          setView('list')
          setActiveName(null)
        }}
        onSaved={() => void refreshScan()}
      />
    )
  }

  if (view === 'edit' && activeName) {
    return (
      <ResourceEditView
        resourceType={resourceType}
        resourceName={activeName}
        onBack={() => {
          setView('list')
          setActiveName(null)
        }}
      />
    )
  }

  const listProps = {
    filterState,
    onFilterChange: handleFilterChange,
    onAssign: (name: string) => {
      setActiveName(name)
      setView('assign')
    },
    onEdit: (name: string) => {
      setActiveName(name)
      setView('edit')
    },
    onRefresh: () => void refreshScan(),
    onAdd: showAdd && isCreatableResourceType(resourceType) ? () => setAddOpen(true) : undefined
  }

  return (
    <>
      {resourceType === 'hook' ? (
        <HooksListView
          summaries={summaries}
          loading={loading}
          {...listProps}
          onRename={handleRename}
          onDelete={handleDelete}
        />
      ) : (
        <ResourceListView
          title={title}
          subtitle={subtitle}
          resourceType={resourceType}
          {...listProps}
        />
      )}
      {addOpen && isCreatableResourceType(resourceType) && (
        <AddResourceModal
          resourceType={resourceType}
          onClose={() => setAddOpen(false)}
          onCreated={(name) => {
            void refreshScan()
            void loadSummaries()
            if (resourceType === 'skill' && name) {
              setActiveName(name)
              setView('edit')
            }
          }}
        />
      )}
    </>
  )
}
