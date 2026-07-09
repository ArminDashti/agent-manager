import { net } from 'electron'
import { existsSync } from 'fs'
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import type { AppSettings, HubCatalogItem, HubManifest, HubResourceType } from '@shared/types'
import { HUB_TYPE_FOLDERS } from '@shared/utils'
import { getDataPath } from '../app-paths'
import { fileService } from './file.service'
import { settingsStore } from './settings-store'

const DEFAULT_FILES: Record<HubResourceType, string[]> = {
  skill: ['SKILL.md'],
  rule: ['rule.mdc', 'rule.md'],
  mcp: ['mcp.json'],
  hook: ['hooks.json'],
  tool: ['tool.json', 'README.md']
}

export class HubService {
  async fetchCatalog(settings?: AppSettings): Promise<HubManifest> {
    const s = settings ?? settingsStore.get()
    const url = s.hub.catalogUrl

    const manifest = await this.httpGetJson<HubManifest>(url)
    const cachePath = join(getDataPath(s.dataPath), 'hub-cache', 'manifest.json')
    await mkdir(join(getDataPath(s.dataPath), 'hub-cache'), { recursive: true })
    await writeFile(cachePath, JSON.stringify(manifest, null, 2), 'utf-8')

    settingsStore.update((prev) => ({
      ...prev,
      hub: { ...prev.hub, lastFetchAt: new Date().toISOString() }
    }))

    return manifest
  }

  async listCatalog(settings?: AppSettings): Promise<HubCatalogItem[]> {
    const s = settings ?? settingsStore.get()
    let manifest: HubManifest | null = null

    try {
      manifest = await this.fetchCatalog(s)
    } catch {
      const cachePath = join(getDataPath(s.dataPath), 'hub-cache', 'manifest.json')
      if (existsSync(cachePath)) {
        manifest = JSON.parse(await fileService.readText(cachePath)) as HubManifest
      }
    }

    if (!manifest) return []

    const items: HubCatalogItem[] = []
    const types: HubResourceType[] = ['skill', 'rule', 'mcp', 'hook', 'tool']

    for (const type of types) {
      const folder = HUB_TYPE_FOLDERS[type]
      const names = manifest[folder as keyof HubManifest] as string[] | undefined
      if (!names) continue

      for (const name of names) {
        items.push({
          id: `${type}:${name}`,
          type,
          name,
          fetchUrl: `${s.hub.baseUrl}/hub/${folder}/${name}/`
        })
      }
    }

    if (manifest.items) {
      for (const item of manifest.items) {
        if (!items.find((i) => i.id === `${item.type}:${item.name}`)) {
          items.push({
            id: `${item.type}:${item.name}`,
            type: item.type,
            name: item.name,
            description: item.description,
            tags: item.tags,
            fetchUrl: `${s.hub.baseUrl}/hub/${HUB_TYPE_FOLDERS[item.type]}/${item.name}/`
          })
        }
      }
    }

    return items.sort((a, b) => a.name.localeCompare(b.name))
  }

  async fetchResource(type: HubResourceType, name: string): Promise<string> {
    const s = settingsStore.get()
    const folder = HUB_TYPE_FOLDERS[type]
    const baseUrl = `${s.hub.baseUrl}/hub/${folder}/${name}`
    const destDir = join(getDataPath(s.dataPath), 'hub-cache', folder, name)
    await mkdir(destDir, { recursive: true })

    const manifestItem = (await this.listCatalog()).find((i) => i.type === type && i.name === name)
    const files =
      (s as AppSettings & { hubFiles?: string[] }).hubFiles ?? DEFAULT_FILES[type]

    for (const file of files) {
      try {
        const content = await this.httpGetText(`${baseUrl}/${file}`)
        await writeFile(join(destDir, file), content, 'utf-8')
      } catch {
        // file may not exist for this resource
      }
    }

    return destDir
  }

  async installResource(
    type: HubResourceType,
    name: string,
    destDir: string
  ): Promise<void> {
    const s = settingsStore.get()
    const folder = HUB_TYPE_FOLDERS[type]
    const src = join(getDataPath(s.dataPath), 'hub-cache', folder, name)

    if (!existsSync(src)) {
      await this.fetchResource(type, name)
    }

    await fileService.copyDirectory(src, join(destDir, name))
  }

  private httpGetText(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const request = net.request(url)
      request.on('response', (response) => {
        let data = ''
        response.on('data', (chunk) => {
          data += chunk.toString()
        })
        response.on('end', () => {
          if (response.statusCode && response.statusCode >= 400) {
            reject(new Error(`HTTP ${response.statusCode} for ${url}`))
          } else {
            resolve(data)
          }
        })
      })
      request.on('error', reject)
      request.end()
    })
  }

  private async httpGetJson<T>(url: string): Promise<T> {
    const text = await this.httpGetText(url)
    return JSON.parse(text) as T
  }
}

export const hubService = new HubService()
