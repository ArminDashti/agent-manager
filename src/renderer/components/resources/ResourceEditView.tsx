import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  HookResource,
  ResourceType,
  RuleResource,
  SkillResource,
  SubAgentResource,
  ToolResource
} from '@shared/types'
import { isMarkdownFile } from '@shared/utils.browser'
import { FileTree } from '@renderer/components/FileTree'
import { MarkdownEditor } from '@renderer/components/MarkdownEditor'
import { JsonEditor } from '@renderer/components/JsonEditor'
import { TwoPanelLayout } from '@renderer/components/layout/TwoPanelLayout'
import { ResourceSubViewHeader } from './ResourceListView'

type ListableResourceType = Exclude<ResourceType, 'mcp'>
type CanonicalResource =
  | SkillResource
  | RuleResource
  | HookResource
  | SubAgentResource
  | ToolResource

interface ResourceEditViewProps {
  resourceType: ListableResourceType
  resourceName: string
  onBack: () => void
}

function getFiles(resource: CanonicalResource, resourceType: ListableResourceType): string[] {
  switch (resourceType) {
    case 'skill':
      return (resource as SkillResource).files
    case 'rule':
      return [(resource as RuleResource).filePath]
    case 'hook': {
      const h = resource as HookResource
      const list = [...h.scriptFiles]
      if (!list.includes(h.configPath)) list.unshift(h.configPath)
      return list
    }
    case 'subAgent':
      return [(resource as SubAgentResource).filePath]
    case 'tool':
      return (resource as ToolResource).files
    default:
      return []
  }
}

function getRootPath(resource: CanonicalResource, resourceType: ListableResourceType): string | undefined {
  switch (resourceType) {
    case 'skill':
      return (resource as SkillResource).rootPath
    case 'tool':
      return (resource as ToolResource).rootPath
    default:
      return undefined
  }
}

function getDefaultFile(resource: CanonicalResource, resourceType: ListableResourceType): string {
  switch (resourceType) {
    case 'skill':
      return (resource as SkillResource).skillMdPath
    case 'rule':
      return (resource as RuleResource).filePath
    case 'hook': {
      const h = resource as HookResource
      return h.scriptPath ?? h.configPath
    }
    case 'subAgent':
      return (resource as SubAgentResource).filePath
    case 'tool': {
      const t = resource as ToolResource
      return t.files.find((f) => f.endsWith('tool.json')) ?? t.files[0] ?? t.rootPath
    }
    default:
      return ''
  }
}

export function ResourceEditView({ resourceType, resourceName, onBack }: ResourceEditViewProps) {
  const [resource, setResource] = useState<CanonicalResource | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const canonical = await window.agentManager.getCanonicalResource(resourceType, resourceName)
      if (!canonical) {
        setResource(null)
        return
      }
      setResource(canonical)
      const file = getDefaultFile(canonical, resourceType)
      setSelectedFile(file)
      setContent(await window.agentManager.readFile(file))
    } finally {
      setLoading(false)
    }
  }, [resourceType, resourceName])

  useEffect(() => {
    void load()
  }, [load])

  const files = useMemo(
    () => (resource ? getFiles(resource, resourceType) : []),
    [resource, resourceType]
  )

  const openFile = async (path: string) => {
    setSelectedFile(path)
    setContent(await window.agentManager.readFile(path))
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <ResourceSubViewHeader title={`Edit: ${resourceName}`} onBack={onBack} />
        <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">Loading…</div>
      </div>
    )
  }

  if (!resource) {
    return (
      <div className="flex flex-col h-full">
        <ResourceSubViewHeader title={`Edit: ${resourceName}`} onBack={onBack} />
        <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
          Resource not found
        </div>
      </div>
    )
  }

  const showTree = resourceType !== 'rule' && resourceType !== 'subAgent' && files.length > 1

  return (
    <div className="flex flex-col h-full">
      <ResourceSubViewHeader title={`Edit: ${resourceName}`} onBack={onBack} />
      <div className="flex-1 min-h-0">
        {showTree ? (
          <TwoPanelLayout
            autoSaveId={`edit-${resourceType}-panels`}
            left={
              <FileTree
                files={files}
                selected={selectedFile ?? undefined}
                onSelect={(p) => void openFile(p)}
                rootPath={getRootPath(resource, resourceType)}
              />
            }
            right={
              selectedFile ? (
                <EditorPane filePath={selectedFile} content={content} onChange={setContent} />
              ) : (
                <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
                  Select a file
                </div>
              )
            }
          />
        ) : (
          <div className="h-full p-2">
            {selectedFile && (
              <EditorPane filePath={selectedFile} content={content} onChange={setContent} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function EditorPane({
  filePath,
  content,
  onChange
}: {
  filePath: string
  content: string
  onChange: (v: string) => void
}) {
  const isMd = isMarkdownFile(filePath) || filePath.endsWith('.py')
  if (isMd) {
    return (
      <MarkdownEditor
        filePath={filePath}
        value={content}
        onChange={onChange}
        onSave={async (v) => {
          await window.agentManager.writeFile(filePath, v)
        }}
      />
    )
  }
  return (
    <JsonEditor
      value={content}
      onChange={onChange}
      onSave={async (v) => {
        await window.agentManager.writeFile(filePath, v)
      }}
    />
  )
}
