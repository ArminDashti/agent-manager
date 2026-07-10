import { useState } from 'react'
import type { ResourceType } from '@shared/types'
import { ResourceListView } from './ResourceListView'
import { ResourceAssignView } from './ResourceAssignView'
import { ResourceEditView } from './ResourceEditView'
import { AddResourceModal, isCreatableResourceType } from './AddResourceModal'
import { useAppStore } from '@renderer/stores/appStore'

type ListableResourceType = Exclude<ResourceType, 'mcp'>
type ViewMode = 'list' | 'assign' | 'edit'

interface ResourcePageProps {
  title: string
  subtitle?: string
  resourceType: ListableResourceType
  showAdd?: boolean
}

export function ResourcePage({ title, subtitle, resourceType, showAdd = false }: ResourcePageProps) {
  const { refreshScan } = useAppStore()
  const [view, setView] = useState<ViewMode>('list')
  const [activeName, setActiveName] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)

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

  return (
    <>
      <ResourceListView
        title={title}
        subtitle={subtitle}
        resourceType={resourceType}
        onAssign={(name) => {
          setActiveName(name)
          setView('assign')
        }}
        onEdit={(name) => {
          setActiveName(name)
          setView('edit')
        }}
        onRefresh={() => void refreshScan()}
        onAdd={showAdd && isCreatableResourceType(resourceType) ? () => setAddOpen(true) : undefined}
      />
      {addOpen && isCreatableResourceType(resourceType) && (
        <AddResourceModal
          resourceType={resourceType}
          onClose={() => setAddOpen(false)}
          onCreated={(name) => {
            void refreshScan()
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
